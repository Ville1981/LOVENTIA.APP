import express from 'express';
import Joi, { Schema } from 'joi';

interface ValidationSource {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

/**
 * Rakentaa Express-middlewaret validointiin.
 * @param schemas – Joi-skeemat source-olioissa.
 */
export function validate(schemas: ValidationSource): express.RequestHandler {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    const toValidate: Array<[keyof ValidationSource, any]> = [
      ['body', req.body],
      ['query', req.query],
      ['params', req.params],
    ];

    for (const [key, value] of toValidate) {
      if (!schemas[key]) continue;
      const { error, value: sanitized } = schemas[key]!.validate(value, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        res.status(400).json({
          status: 'error',
          message: `Invalid ${key}`,
          details: error.details.map(d => d.message),
        });
        return;  // EI return res..., vaan paluu undefined:ksi
      }
      // Korvaa req.body/req.query/req.params puhdistetulla versiolla
      (req as any)[key] = sanitized;
    }

    next();
  };
}
