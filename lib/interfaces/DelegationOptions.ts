export interface DelegationOptions {
    /**
     * The name of the parent zone (domain)
     */
    parentDomain: string,
    /**
     * The id of the account containing the parent zone
     */
    accountId: string,
    /**
     * The name of the role which has the required route53 permissions,
     * and can be assumed from the deploying account.
     */
    roleName: string
}
