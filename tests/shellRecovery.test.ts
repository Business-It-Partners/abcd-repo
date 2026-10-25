import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ShellErrorBoundary } from '../src/ShellErrorBoundary';
import { WindowContentBoundary } from '../src/WindowContentBoundary';

it('contains an App Store content error inside its window and offers a retry', () => {
  const error = new Error('private renderer stack must not be shown');
  const props = { title: 'App Store', resetKey: 'visible', children: createElement('div', null, 'Store content') };
  const boundary = new WindowContentBoundary(props);
  const failure = WindowContentBoundary.getDerivedStateFromError(error);
  expect(failure).toEqual({ failed: true });
  boundary.state = { failed: true, resetKey: props.resetKey };

  const fallback = renderToStaticMarkup(boundary.render());
  expect(fallback).toContain('role="alert"');
  expect(fallback).toContain('App Store is unavailable');
  expect(fallback).toContain('Close and reopen this window, or retry its content.');
  expect(fallback).toContain('Retry content');
  expect(fallback).not.toContain(error.message);
});

it('recovers one window boundary when its window lifecycle changes', () => {
  expect(WindowContentBoundary.getDerivedStateFromProps(
    { title: 'App Store', resetKey: 'reopened', children: null },
    { failed: true, resetKey: 'visible' },
  )).toEqual({ failed: false, resetKey: 'reopened' });
});

it('keeps the shell-level React fallback limited to shell reload controls', () => {
  const error = new Error('private shell renderer stack must not be shown');
  const boundary = new ShellErrorBoundary({ children: createElement('main', null, 'Desktop') });
  expect(ShellErrorBoundary.getDerivedStateFromError(error)).toEqual({ failed: true });
  boundary.state = { failed: true };

  const fallback = renderToStaticMarkup(boundary.render());
  expect(fallback).toContain('Sajilo Dental is restoring the desktop');
  expect(fallback).toContain('The platform session remains active.');
  expect(fallback).toContain('Reload desktop');
  expect(fallback).not.toContain(error.message);
});
