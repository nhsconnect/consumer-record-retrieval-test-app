/**
 * Handles all GET requests to any non-root path
 */

import { Request, Response, NextFunction } from 'express';

import fs from 'fs';
import path from 'path';

import runValidations from './run-validations';
import Validations from './validations';
import setMimeType from './set-mime-type';

import httpStatus from './http-status';
import config from './config';

import { buildLogEntry, writeLog } from './logs';
import { TLSSocket } from 'tls';
import { fileEndpointMapping } from './file-endpoint-mapping';
import checkSecureMode from './check-secure-mode';

const { environment } = config;

const secureMode = checkSecureMode(config);

const VALIDATION_IDS = {
    responseCode: 'response-code',
};

const getFromMockEndpoint = (
    request: Request,
    response: Response,
    next: NextFunction,
) => {
    const validations = new Validations(request, response);

    validations
        .add(VALIDATION_IDS.responseCode, 'Request returns 2XX response code')
        .setFailureState(false); // initialize to success

    const fail = (response: Response, code: number, message: any) => {
        validations
            .find(VALIDATION_IDS.responseCode)
            .setFailureState(
                `Request failed with status ${code}: ${JSON.stringify(
                    message,
                )}`,
            );

        response.status(code).send(message);

        return next();
    };

    if (secureMode) {
        const certificate = (request.connection as TLSSocket).getPeerCertificate();
        const isAuthorised: boolean = (request as any).client.authorized;

        if (!isAuthorised) {
            if (certificate.subject) {
                return fail(response, httpStatus.Forbidden, {
                    certificate: {
                        subject: certificate.subject.CN || null,
                        issuer: certificate.issuer.CN || null,
                    },
                    message: 'Unauthorized client certificate',
                });
            } else {
                return fail(response, httpStatus.Unauthorized, {
                    certificate: null,
                    message: 'No client certificate',
                });
            }
        }
    }

    // `path` var is already in use by node's `path` module
    const $path = request.url.slice(1);

    if (environment === 'local' && $path.includes('/')) {
        response
            .status(httpStatus.BadRequest)
            .send(
                'Provider URL must be percent-encoded (cannot contain unescaped forward-slashes)',
            );

        return next();
    }

    runValidations(validations);

    // logging
    response.on('finish', () => {
        const logEntry = buildLogEntry(request, response, validations);
        writeLog(logEntry);
    });

    if (response.headersSent) {
        return next();
    }

    if (validations.list().some(validation => validation.success === false)) {
        const data = {
            failures: validations
                .listSerializable()
                .filter(validation => validation.success === false),
        };

        return fail(response, httpStatus.BadRequest, data);
    }

    let endpoint: string;

    if (environment === 'local') {
        try {
            endpoint = decodeURIComponent($path);
        } catch {
            return fail(
                response,
                httpStatus.BadRequest,
                `${$path} cannot be percent-decoded`,
            );
        }

        try {
            new URL(endpoint);
        } catch {
            return fail(
                response,
                httpStatus.BadRequest,
                `${endpoint} is not a valid URL`,
            );
        }
    } else {
        endpoint = '/' + $path;
    }

    const fileName = fileEndpointMapping.find(row => row.endpoint === endpoint)
        ?.file;

    if (!fileName) {
        return fail(
            response,
            httpStatus.NotFound,
            `A filename corresponding to endpoint ${endpoint} must exist in file-endpoint-mapping.tsv`,
        );
    }

    const filePath = path.join(__dirname, '..', 'responses', fileName);

    if (!fs.existsSync(filePath)) {
        return fail(
            response,
            httpStatus.NotFound,
            `fileName ${fileName} must exist as a file in the responses folder`,
        );
    }

    setMimeType(request, response);

    return response.sendFile(filePath, next); // `next` fn must be in callback - see https://stackoverflow.com/a/33767854
};

export default getFromMockEndpoint;
