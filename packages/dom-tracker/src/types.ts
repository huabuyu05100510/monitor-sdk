export interface ApiDataSource {
  url: string;
  method: string;
  params?: Record<string, any>;
  timestamp: number;
}

export interface JsResourceSource {
  component: string;
  file: string;
  line: number;
  column: number;
}

export interface DomMetadata {
  apiSource?: ApiDataSource;
  jsSource: JsResourceSource;
  componentStack: string[];
}
