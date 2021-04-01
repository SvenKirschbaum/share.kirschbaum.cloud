import Keycloak from 'keycloak-js'

// Setup Keycloak instance as needed
// Pass initialization options as required or leave blank to load from 'keycloak.json'
// @ts-ignore
const keycloak = new Keycloak({
    url: process.env.REACT_APP_KEYCLOAK,
    realm: process.env.REACT_APP_REALM,
    clientId: process.env.REACT_APP_CLIENT_ID
});

export default keycloak