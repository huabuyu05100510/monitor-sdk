import type { DomMetadata } from './types';

const metadataMap = new WeakMap<Element, DomMetadata>();

export function setDomMetadata(element: Element, metadata: DomMetadata): void {
  metadataMap.set(element, metadata);
}

export function getDomMetadata(element: Element): DomMetadata | undefined {
  return metadataMap.get(element);
}

export function clearDomMetadata(element: Element): void {
  metadataMap.delete(element);
}
