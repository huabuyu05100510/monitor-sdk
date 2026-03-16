import React, { useEffect, useRef, forwardRef, cloneElement } from 'react';
import { setDomMetadata } from './metadataStore';
import type { DomMetadata } from './types';

interface WithDataTrackerOptions {
  componentName?: string;
  filePath?: string;
  wrapperTag?: string;
}

export function withDataTracker<
  T extends React.ForwardRefExoticComponent<React.PropsWithoutRef<any> & React.RefAttributes<any>>
>(
  Component: T,
  options: WithDataTrackerOptions = {}
): React.ForwardRefExoticComponent<React.PropsWithoutRef<React.ComponentProps<T>> & React.RefAttributes<unknown>> {
  const { componentName: optionComponentName, filePath, wrapperTag = 'div' } = options;

  // Determine the component name from options or the Component itself
  const componentName = optionComponentName || (Component as any).displayName || (Component as any).name || 'UnknownComponent';
  const effectiveFilePath = filePath || 'unknown';

  const Wrapper = forwardRef((props: React.ComponentProps<T>, ref: React.Ref<unknown>) => {
    const wrapperRef = useRef<HTMLElement>(null);
    const wrapperId = useRef<string>('wrapper-' + Math.random().toString(36).substr(2, 9));

    useEffect(() => {
      if (wrapperRef.current) {
        const metadata: DomMetadata = {
          jsSource: {
            component: componentName,
            file: effectiveFilePath,
            line: 0,
            column: 0,
          },
          componentStack: [componentName],
        };
        setDomMetadata(wrapperRef.current, metadata);
      }
    }, [componentName, effectiveFilePath]);

    // Clone the component element and attach the forwarded ref to it
    const componentElement = React.createElement(Component, props);

    return React.createElement(
      wrapperTag,
      {
        ref: wrapperRef,
        'data-data-tracker-wrapper': wrapperId.current,
      },
      cloneElement(componentElement, {
        ref: ref as React.Ref<unknown>,
      })
    );
  });

  const displayName = componentName;
  Wrapper.displayName = `WithDataTracker(${displayName})`;

  return Wrapper;
}

// Also export a simpler hook-based approach for functional components
export function useDataTracker(
  element: React.RefObject<Element>,
  componentName: string,
  filePath: string
): void {
  useEffect(() => {
    if (element.current) {
      const metadata: DomMetadata = {
        jsSource: {
          component: componentName,
          file: filePath,
          line: 0,
          column: 0,
        },
        componentStack: [componentName],
      };
      setDomMetadata(element.current, metadata);
    }
  }, [element, componentName, filePath]);
}