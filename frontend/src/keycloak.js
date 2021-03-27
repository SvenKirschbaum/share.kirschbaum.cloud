import Keycloak from 'keycloak-js'

// Setup Keycloak instance as needed
// Pass initialization options as required or leave blank to load from 'keycloak.json'
// @ts-ignore
const keycloak = new Keycloak({
    url: 'https://id.elite12.de/auth',
    realm: 'elite12',
    clientId: 'cloud-share-frontend'
});

export default keycloak