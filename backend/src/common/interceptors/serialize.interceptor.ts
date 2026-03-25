import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { camelCase } from 'lodash';

function convertToCamelCase(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(v => convertToCamelCase(v));
    }
    return Object.keys(obj).reduce((result, key) => {
        const camelKey = camelCase(key);
        result[camelKey] = convertToCamelCase(obj[key]);
        return result;
    }, {} as any);
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map(data => convertToCamelCase(data)),
        );
    }
}