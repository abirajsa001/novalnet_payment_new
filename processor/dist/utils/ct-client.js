"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectApiRoot = void 0;
exports.getApiRoot = getApiRoot;
const sdk_client_v2_1 = require("@commercetools/sdk-client-v2");
const platform_sdk_1 = require("@commercetools/platform-sdk");
const projectKey = 'testkeyproject';
const authUrl = 'https://auth.europe-west1.gcp.commercetools.com';
const apiUrl = 'https://api.europe-west1.gcp.commercetools.com';
const clientId = '4Qov22_iYZi5Z0Ed5_-bVcf3';
const clientSecret = 'HzP7uITPekVYNp9VTXtFSGjkRllCF-cd';
const authMiddlewareOptions = {
    host: "https://auth.europe-west1.gcp.commercetools.com",
    projectKey,
    credentials: {
        clientId: '4Qov22_iYZi5Z0Ed5_-bVcf3',
        clientSecret: 'HzP7uITPekVYNp9VTXtFSGjkRllCF-cd',
    },
};
const httpMiddlewareOptions = {
    host: "https://api.europe-west1.gcp.commercetools.com",
};
const ctpClient = new sdk_client_v2_1.ClientBuilder()
    .withClientCredentialsFlow(authMiddlewareOptions)
    .withHttpMiddleware(httpMiddlewareOptions)
    .build();
// THIS is your "projectApiRoot"
exports.projectApiRoot = (0, platform_sdk_1.createApiBuilderFromCtpClient)(ctpClient)
    .withProjectKey({ projectKey });
function getApiRoot() {
    const client = new sdk_client_v2_1.ClientBuilder()
        .withProjectKey(projectKey)
        .withClientCredentialsFlow({
        host: authUrl,
        projectKey,
        credentials: { clientId, clientSecret },
        fetch, // global fetch in Node 18+
    })
        .withHttpMiddleware({ host: apiUrl, fetch })
        .build();
    // Must scope API to project key to access resources like orders()
    return (0, platform_sdk_1.createApiBuilderFromCtpClient)(client).withProjectKey({ projectKey });
}
