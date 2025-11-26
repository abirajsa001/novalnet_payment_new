"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiRoot = getApiRoot;
const sdk_client_v2_1 = require("@commercetools/sdk-client-v2");
const platform_sdk_1 = require("@commercetools/platform-sdk");
//~ const projectKey = process.env.CTP_PROJECT_KEY!;
//~ const clientId = process.env.CTP_CLIENT_ID!;
//~ const clientSecret = process.env.CTP_CLIENT_SECRET!;
//~ const authUrl = process.env.CTP_AUTH_URL!;
//~ const apiUrl = process.env.CTP_API_URL!;
const projectKey = 'newprojectkey';
const authUrl = 'https://auth.europe-west1.gcp.commercetools.com';
const apiUrl = 'https://api.europe-west1.gcp.commercetools.com';
const clientId = 'PvpIwckG4tM69ATbESCg362e';
const clientSecret = 'hLSoCgHZu7er7zNVhnqTWgFsTuJllBXL';
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
