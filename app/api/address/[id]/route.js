import { NextResponse } from 'next/server';
import dbConnect from '@/backend/config/dbConnect';
import Address from '@/backend/models/address';
import User from '@/backend/models/user';
import isAuthenticatedUser from '@/backend/middlewares/auth';
import { validateAddress } from '@/helpers/validation/schemas/address';
import { sanitizeAddress } from '@/utils/addressSanitizer';
import { captureException } from '@/monitoring/sentry';
import { withApiRateLimit } from '@/utils/rateLimit';

/**
 * GET /api/address/[id]
 * Récupère une adresse spécifique
 * Rate limit: 60 req/min (public) ou 120 req/min (authenticated)
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/address/* :
 * - Cache-Control: private, no-cache, no-store, must-revalidate
 * - Pragma: no-cache
 * - X-Content-Type-Options: nosniff
 * - X-Robots-Tag: noindex, nofollow
 * - X-Download-Options: noopen
 *
 * Headers globaux appliqués automatiquement :
 * - HSTS, CSP, Permissions-Policy, X-Frame-Options, Referrer-Policy
 */
export const GET = withApiRateLimit(async function (req, { params }) {
  try {
    // Vérifier l'authentification
    await isAuthenticatedUser(req, NextResponse);

    // Connexion DB
    await dbConnect();

    // Validation de l'ID
    const { id } = params;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid address ID',
          code: 'INVALID_ID',
        },
        { status: 400 },
      );
    }

    // Récupérer l'utilisateur
    const user = await User.findOne({ email: req.user.email }).select('_id');
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // Récupérer l'adresse
    const address = await Address.findById(id)
      .select(
        'street city state zipCode country isDefault additionalInfo user createdAt updatedAt',
      )
      .lean();

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          message: 'Address not found',
          code: 'ADDRESS_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    // Vérifier la propriété
    if (address.user?.toString() !== user._id.toString()) {
      // Log de sécurité pour tentative d'accès non autorisé
      console.warn('🚨 Unauthorized address access attempt:', {
        userId: user._id,
        addressId: id,
        addressOwnerId: address.user,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
          code: 'UNAUTHORIZED_ACCESS',
        },
        { status: 403 },
      );
    }

    // ============================================
    // Headers de sécurité appliqués automatiquement
    // Pas de cache pour les données personnelles
    // Protection maximale via next.config.mjs
    // ============================================

    return NextResponse.json(
      {
        success: true,
        data: {
          address: {
            _id: address._id,
            street: address.street,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country,
            isDefault: address.isDefault,
            additionalInfo: address.additionalInfo,
            createdAt: address.createdAt,
            updatedAt: address.updatedAt,
          },
        },
      },
      {
        status: 200,
        // Pas de headers manuels
      },
    );
  } catch (error) {
    console.error('GET address error:', error.message);

    // Capturer seulement les vraies erreurs système
    if (error.name !== 'ValidationError' && error.name !== 'CastError') {
      captureException(error, {
        tags: { component: 'api', route: 'address/[id]/GET' },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error.name === 'CastError'
            ? 'Invalid address ID format'
            : 'Something went wrong',
        code:
          error.name === 'CastError' ? 'INVALID_ID_FORMAT' : 'INTERNAL_ERROR',
      },
      { status: error.name === 'CastError' ? 400 : 500 },
    );
  }
});

/**
 * PUT /api/address/[id]
 * Met à jour une adresse
 * Rate limit: 20 modifications par 5 minutes (protection contre les modifications abusives)
 *
 * Headers de sécurité appliqués automatiquement via next.config.mjs
 */
export const PUT = withApiRateLimit(
  async function (req, { params }) {
    try {
      // Vérifier l'authentification
      await isAuthenticatedUser(req, NextResponse);

      // Connexion DB
      await dbConnect();

      // Validation de l'ID
      const { id } = params;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid address ID',
            code: 'INVALID_ID',
          },
          { status: 400 },
        );
      }

      // Récupérer l'utilisateur
      const user = await User.findOne({ email: req.user.email }).select('_id');
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      // Parser et sanitiser les données
      let addressData;
      try {
        const rawData = await req.json();
        addressData = sanitizeAddress(rawData);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid request body',
            code: 'INVALID_BODY',
          },
          { status: 400 },
        );
      }

      // Valider avec Yup
      const validation = await validateAddress(addressData);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            message: 'Validation failed',
            code: 'VALIDATION_FAILED',
            errors: validation.errors,
          },
          { status: 400 },
        );
      }

      // Vérifier que l'adresse existe et appartient à l'utilisateur
      const existingAddress = await Address.findById(id);
      if (!existingAddress) {
        return NextResponse.json(
          {
            success: false,
            message: 'Address not found',
            code: 'ADDRESS_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      if (existingAddress.user.toString() !== user._id.toString()) {
        // Log de sécurité pour tentative de modification non autorisée
        console.warn('🚨 Unauthorized address update attempt:', {
          userId: user._id,
          addressId: id,
          addressOwnerId: existingAddress.user,
          timestamp: new Date().toISOString(),
          ip:
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            'unknown',
        });

        return NextResponse.json(
          {
            success: false,
            message: 'Unauthorized',
            code: 'UNAUTHORIZED_UPDATE',
          },
          { status: 403 },
        );
      }

      // Si c'est la nouvelle adresse par défaut, désactiver les autres
      if (validation.data.isDefault === true && !existingAddress.isDefault) {
        await Address.updateMany(
          { user: user._id, isDefault: true, _id: { $ne: id } },
          { isDefault: false },
        );
      }

      // Mettre à jour l'adresse
      const updatedAddress = await Address.findByIdAndUpdate(
        id,
        {
          ...validation.data,
          user: user._id,
          updatedAt: new Date(),
        },
        {
          new: true,
          runValidators: true,
          select:
            'street city state zipCode country isDefault additionalInfo updatedAt',
        },
      ).lean();

      // Log de sécurité pour audit
      console.log('🔒 Security event - Address updated:', {
        userId: user._id,
        addressId: id,
        changedToDefault:
          validation.data.isDefault && !existingAddress.isDefault,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Address updated successfully',
          data: {
            address: updatedAddress,
            meta: {
              wasDefault: existingAddress.isDefault,
              isNowDefault: updatedAddress.isDefault,
            },
          },
        },
        {
          status: 200,
          // Headers appliqués automatiquement
        },
      );
    } catch (error) {
      console.error('PUT address error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (error.name !== 'ValidationError' && error.name !== 'CastError') {
        captureException(error, {
          tags: { component: 'api', route: 'address/[id]/PUT' },
        });
      }

      // Gestion simple des erreurs
      let status = 500;
      let message = 'Something went wrong';
      let code = 'INTERNAL_ERROR';

      if (error.name === 'ValidationError') {
        status = 400;
        message = 'Invalid address data';
        code = 'VALIDATION_ERROR';
      } else if (error.name === 'CastError') {
        status = 400;
        message = 'Invalid address ID format';
        code = 'INVALID_ID_FORMAT';
      } else if (error.code === 11000) {
        status = 409;
        message = 'This address already exists';
        code = 'DUPLICATE_ADDRESS';
      }

      return NextResponse.json({ success: false, message, code }, { status });
    }
  },
  {
    customLimit: {
      points: 20, // 20 modifications maximum
      duration: 300000, // par période de 5 minutes
      blockDuration: 600000, // blocage de 10 minutes en cas de dépassement
    },
  },
);

/**
 * DELETE /api/address/[id]
 * Supprime une adresse
 * Rate limit: 5 suppressions par 5 minutes (protection contre les suppressions abusives)
 *
 * Headers de sécurité appliqués automatiquement via next.config.mjs
 */
export const DELETE = withApiRateLimit(
  async function (req, { params }) {
    try {
      // Vérifier l'authentification
      await isAuthenticatedUser(req, NextResponse);

      // Connexion DB
      await dbConnect();

      // Validation de l'ID
      const { id } = params;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid address ID',
            code: 'INVALID_ID',
          },
          { status: 400 },
        );
      }

      // Récupérer l'utilisateur
      const user = await User.findOne({ email: req.user.email }).select('_id');
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      // Vérifier que l'adresse existe et appartient à l'utilisateur
      const address = await Address.findById(id);
      if (!address) {
        return NextResponse.json(
          {
            success: false,
            message: 'Address not found',
            code: 'ADDRESS_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      if (address.user.toString() !== user._id.toString()) {
        // Log de sécurité pour tentative de suppression non autorisée
        console.warn('🚨 Unauthorized address deletion attempt:', {
          userId: user._id,
          addressId: id,
          addressOwnerId: address.user,
          timestamp: new Date().toISOString(),
          ip:
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            'unknown',
        });

        return NextResponse.json(
          {
            success: false,
            message: 'Unauthorized',
            code: 'UNAUTHORIZED_DELETE',
          },
          { status: 403 },
        );
      }

      // Vérifier si c'est la dernière adresse par défaut
      const wasDefault = address.isDefault;
      const remainingAddresses = await Address.countDocuments({
        user: user._id,
        _id: { $ne: id },
      });

      // Supprimer l'adresse
      await Address.findByIdAndDelete(id);

      // Si c'était l'adresse par défaut et qu'il reste d'autres adresses
      let newDefaultSet = false;
      if (wasDefault && remainingAddresses > 0) {
        // Définir la plus récente comme nouvelle adresse par défaut
        const latestAddress = await Address.findOne({ user: user._id }).sort({
          createdAt: -1,
        });

        if (latestAddress) {
          latestAddress.isDefault = true;
          await latestAddress.save();
          newDefaultSet = true;
        }
      }

      // Log de sécurité pour audit
      console.log('🔒 Security event - Address deleted:', {
        userId: user._id,
        addressId: id,
        wasDefault,
        newDefaultSet,
        remainingCount: remainingAddresses,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown',
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Address deleted successfully',
          data: {
            deletedId: id,
            wasDefault,
            newDefaultSet,
            remainingAddresses,
          },
        },
        {
          status: 200,
          // Headers de sécurité appliqués automatiquement
        },
      );
    } catch (error) {
      console.error('DELETE address error:', error.message);

      // Capturer seulement les vraies erreurs système
      if (error.name !== 'ValidationError' && error.name !== 'CastError') {
        captureException(error, {
          tags: { component: 'api', route: 'address/[id]/DELETE' },
        });
      }

      return NextResponse.json(
        {
          success: false,
          message:
            error.name === 'CastError'
              ? 'Invalid address ID format'
              : 'Something went wrong',
          code:
            error.name === 'CastError' ? 'INVALID_ID_FORMAT' : 'INTERNAL_ERROR',
        },
        { status: error.name === 'CastError' ? 400 : 500 },
      );
    }
  },
  {
    customLimit: {
      points: 5, // 5 suppressions maximum
      duration: 300000, // par période de 5 minutes
      blockDuration: 1800000, // blocage de 30 minutes (plus strict pour les suppressions)
    },
  },
);
