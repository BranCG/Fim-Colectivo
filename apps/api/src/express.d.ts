import * as express from 'express-serve-static-core';

declare module 'express-serve-static-core' {
  export interface Request {
    query: Record<string, string>;
    params: Record<string, string>;
  }
}
