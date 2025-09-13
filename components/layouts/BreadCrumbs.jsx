import { memo } from 'react';
import Link from 'next/link';

import { isArrayEmpty } from '@/helpers/helpers';
import { ChevronRight } from 'lucide-react';

const BreadCrumbs = memo(({ breadCrumbs }) => {
  return (
    <section className="py-5 sm:py-7 bg-blue-100">
      <div className="container max-w-(--breakpoint-xl) mx-auto px-4">
        <ol className="inline-flex flex-wrap text-gray-600 space-x-1 md:space-x-3 items-center">
          {isArrayEmpty(breadCrumbs)
            ? ''
            : breadCrumbs?.map((breadCrumb, index) => (
                <li className="inline-flex items-center" key={index}>
                  <Link
                    href={breadCrumb.url}
                    className="text-gray-600 hover:text-blue-600"
                  >
                    {breadCrumb.name}
                  </Link>
                  {breadCrumbs?.length - 1 !== index && (
                    <ChevronRight className="ml-3 text-gray-400" />
                  )}
                </li>
              ))}
        </ol>
      </div>
    </section>
  );
});

BreadCrumbs.displayName = 'BreadCrumbs';

export default BreadCrumbs;
