import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { getDomMetadata } from './metadataStore';
import { withDataTracker, useDataTracker } from './withDataTracker';

describe('withDataTracker', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should wrap a functional component and set metadata', async () => {
    const Button = ({ label }: { label: string }) => <button>{label}</button>;
    const TrackedButton = withDataTracker(Button, {
      componentName: 'Button',
      filePath: '/src/components/Button.tsx',
    });

    render(<TrackedButton label="Click me" />);

    // Find the wrapper div by data attribute
    const wrapperDiv = document.querySelector('[data-data-tracker-wrapper]');
    expect(wrapperDiv).not.toBeNull();

    const metadata = getDomMetadata(wrapperDiv!);

    expect(metadata).toBeDefined();
    expect(metadata?.jsSource.component).toBe('Button');
    expect(metadata?.jsSource.file).toBe('/src/components/Button.tsx');
    expect(metadata?.jsSource.line).toBe(0);
    expect(metadata?.jsSource.column).toBe(0);
    expect(metadata?.componentStack).toEqual(['Button']);
  });

  it('should use component name from options when provided', async () => {
    const Card = () => <div>Card</div>;
    const TrackedCard = withDataTracker(Card, {
      componentName: 'CustomCard',
      filePath: '/src/components/Card.tsx',
    });

    render(<TrackedCard />);

    const wrapperDiv = document.querySelector('[data-data-tracker-wrapper]');
    expect(wrapperDiv).not.toBeNull();

    const metadata = getDomMetadata(wrapperDiv!);

    expect(metadata?.jsSource.component).toBe('CustomCard');
  });

  it('should use displayName from wrapped component when no options provided', async () => {
    const Modal = () => <div>Modal</div>;
    Modal.displayName = 'ModalComponent';
    const TrackedModal = withDataTracker(Modal);

    render(<TrackedModal />);

    const wrapperDiv = document.querySelector('[data-data-tracker-wrapper]');
    expect(wrapperDiv).not.toBeNull();

    const metadata = getDomMetadata(wrapperDiv!);

    expect(metadata?.jsSource.component).toBe('ModalComponent');
  });

  it('should use component name from wrapped component when no options provided', async () => {
    const Header = () => <header>Header</header>;
    const TrackedHeader = withDataTracker(Header);

    render(<TrackedHeader />);

    const wrapperDiv = document.querySelector('[data-data-tracker-wrapper]');
    expect(wrapperDiv).not.toBeNull();

    const metadata = getDomMetadata(wrapperDiv!);

    expect(metadata?.jsSource.component).toBe('Header');
  });

  it('should use default name when no component name available', async () => {
    const TrackedComponent = withDataTracker(() => <span>Anonymous</span>);

    render(<TrackedComponent />);

    const wrapperDiv = document.querySelector('[data-data-tracker-wrapper]');
    expect(wrapperDiv).not.toBeNull();

    const metadata = getDomMetadata(wrapperDiv!);

    expect(metadata?.jsSource.component).toBe('UnknownComponent');
  });

  it('should forward refs to the wrapped component', () => {
    const Input = React.forwardRef<HTMLInputElement, { placeholder: string }>((props, ref) => (
      <input ref={ref} placeholder={props.placeholder} />
    ));

    const TrackedInput = withDataTracker(Input, {
      componentName: 'Input',
      filePath: '/src/components/Input.tsx',
    });

    const ref = React.createRef<HTMLInputElement>();
    render(<TrackedInput ref={ref} placeholder="Enter text" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should have correct displayName for debugging', () => {
    const MyComponent = () => <div>Test</div>;
    const Tracked = withDataTracker(MyComponent, { componentName: 'MyComponent' });

    expect(Tracked.displayName).toBe('WithDataTracker(MyComponent)');
  });

  it('should set metadata with filePath option', async () => {
    const Component = () => <div>Test</div>;
    const Tracked = withDataTracker(Component, {
      componentName: 'TestComponent',
      filePath: '/absolute/path/to/component.tsx',
    });

    render(<Tracked />);

    const wrapperDiv = document.querySelector('[data-data-tracker-wrapper]');
    expect(wrapperDiv).not.toBeNull();

    const metadata = getDomMetadata(wrapperDiv!);

    expect(metadata?.jsSource.file).toBe('/absolute/path/to/component.tsx');
  });

  it('should work with different wrapper tags', async () => {
    const Component = () => <span>Test</span>;
    const Tracked = withDataTracker(Component, {
      componentName: 'SpanComponent',
      wrapperTag: 'section',
    });

    render(<Tracked />);

    const wrapperDiv = document.querySelector('section[data-data-tracker-wrapper]');
    expect(wrapperDiv).not.toBeNull();

    const metadata = getDomMetadata(wrapperDiv!);

    expect(metadata?.jsSource.component).toBe('SpanComponent');
  });
});

describe('useDataTracker', () => {
  it('should set metadata on element when mounted', async () => {
    // Create a component that uses the useDataTracker hook correctly
    const TestComponent = () => {
      const divRef = React.useRef<HTMLDivElement>(null);
      useDataTracker(divRef, 'TestComponent', '/src/Test.tsx');

      return <div ref={divRef}>Test</div>;
    };

    render(<TestComponent />);

    // The ref is attached to the div, but since function components don't support refs,
    // we need to use a different approach - get the div by querying
    // Actually, the ref should be on the div element
    const allDivs = document.querySelectorAll('div');
    // The last div is the one with the ref attached (the component's div)
    const componentDiv = allDivs[allDivs.length - 1];

    const metadata = getDomMetadata(componentDiv!);
    expect(metadata).toBeDefined();
    expect(metadata?.jsSource.component).toBe('TestComponent');
    expect(metadata?.jsSource.file).toBe('/src/Test.tsx');
  });

  it('should not error when element is null', () => {
    const TestComponent = () => {
      const ref = React.useRef<HTMLDivElement>(null);
      useDataTracker(ref, 'TestComponent', '/src/Test.tsx');

      return <div ref={ref}>Test</div>;
    };

    // Should not throw
    render(<TestComponent />);
  });

  it('should update metadata when dependencies change', async () => {
    const TestComponent = ({ name, path }: { name: string; path: string }) => {
      const divRef = React.useRef<HTMLDivElement>(null);
      useDataTracker(divRef, name, path);

      return <div ref={divRef}>Test</div>;
    };

    render(<TestComponent name="First" path="/first.tsx" />);

    const allDivs1 = document.querySelectorAll('div');
    const componentDiv1 = allDivs1[allDivs1.length - 1];
    let metadata = getDomMetadata(componentDiv1!);
    expect(metadata?.jsSource.component).toBe('First');

    // Re-render with different props
    render(<TestComponent name="Second" path="/second.tsx" />);

    const allDivs2 = document.querySelectorAll('div');
    const componentDiv2 = allDivs2[allDivs2.length - 1];
    metadata = getDomMetadata(componentDiv2!);
    expect(metadata?.jsSource.component).toBe('Second');
  });
});