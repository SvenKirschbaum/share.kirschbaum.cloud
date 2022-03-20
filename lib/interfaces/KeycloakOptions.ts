export default interface KeycloakOptions {
    /**
     * URL of the keycloak instance
     */
    url: string;
    /**
     * Name of the keycloak realm
     */
    realm: string;
    /**
     * ClientId used for the frontend
     */
    frontendClientId: string;
    /**
     * ClientId used for the backend
     */
    backendClientId: string;
}
