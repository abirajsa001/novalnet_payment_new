"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransactionCommentsTypes = exports.createTransactionCommentsType = exports.apiRoot = void 0;
const sdk_client_v2_1 = require("@commercetools/sdk-client-v2");
const platform_sdk_1 = require("@commercetools/platform-sdk");
const config_1 = require("../config/config");
const authOptions = {
    host: config_1.config.authUrl,
    projectKey: config_1.config.projectKey,
    credentials: {
        clientId: config_1.config.clientId,
        clientSecret: config_1.config.clientSecret,
    },
};
const httpOptions = {
    host: config_1.config.apiUrl,
};
const ctpClient = new sdk_client_v2_1.ClientBuilder()
    .withClientCredentialsFlow(authOptions)
    .withHttpMiddleware(httpOptions)
    .build();
exports.apiRoot = (0, platform_sdk_1.createApiBuilderFromCtpClient)(ctpClient).withProjectKey({
    projectKey: config_1.config.projectKey,
});
const createTransactionCommentsType = async () => {
    try {
        const typeExists = await exports.apiRoot
            .types()
            .withKey({ key: "novalnet-transaction-comments" })
            .get()
            .execute()
            .catch(() => null);
        if (!typeExists) {
            await exports.apiRoot
                .types()
                .post({
                body: {
                    key: "novalnet-transaction-comments",
                    name: { en: "Novalnet Transaction Comments" },
                    resourceTypeIds: ["transaction"],
                    fieldDefinitions: [
                        {
                            name: "transactionComments",
                            label: { en: "Transaction Comments" },
                            type: { name: "String" },
                            required: false,
                        },
                    ],
                },
            })
                .execute();
        }
    }
    catch (error) {
        console.error("Error creating custom field type:", error);
    }
};
exports.createTransactionCommentsType = createTransactionCommentsType;
const createTransactionCommentsTypes = async () => {
    try {
        const typeExists = await exports.apiRoot
            .types()
            .withKey({ key: "novalnet-transaction-commentss" })
            .get()
            .execute()
            .catch(() => null);
        if (!typeExists) {
            await exports.apiRoot
                .types()
                .post({
                body: {
                    key: "novalnet-transaction-commentss",
                    name: { en: "Novalnet Transaction Commentss" },
                    resourceTypeIds: ["transactions"],
                    fieldDefinitions: [
                        {
                            name: "transactionCommentss",
                            label: { en: "Transaction Commentss" },
                            type: { name: "String" },
                            required: false,
                        },
                    ],
                },
            })
                .execute();
        }
    }
    catch (error) {
        console.error("Error creating custom field types:", error);
    }
};
exports.createTransactionCommentsTypes = createTransactionCommentsTypes;
