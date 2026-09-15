import { AgencyMembershipRole } from "@prisma/client"

/**
 * Who may change a project they do not own.
 *
 * This module is kept free of runtime imports - no prisma, no env - for the same reason
 * plan_limits.ts is: the rule can then be exercised by a plain `tsx` test without standing up
 * a database client, and the enforcement path and the test read the same code. Importing
 * project_access.ts to reach this rule would construct a Prisma client at import time and
 * require DATABASE_URL to be set before any assertion could run.
 *
 * `@prisma/client` is a type-and-enum import only; it pulls in no connection.
 */

/**
 * Agency staff roles that may write to a project. AgencyMembershipRole also contains
 * CLIENT_ADMIN and CLIENT_VIEWER, which describe a client's standing rather than a staff
 * member's; neither belongs on a membership, and listing only the four staff roles means that
 * if one ever appears there it does not silently carry write access with it.
 *
 * ANALYST is included deliberately. agencyRoleCanManage (OWNER/ADMIN) governs managing the
 * agency itself - inviting members, changing client settings - which is a different question
 * from doing the client work. An analyst who cannot add a prompt cannot do their job.
 */
export const AGENCY_STAFF_WRITE_ROLES = new Set<AgencyMembershipRole>([
    AgencyMembershipRole.OWNER,
    AgencyMembershipRole.ADMIN,
    AgencyMembershipRole.MANAGER,
    AgencyMembershipRole.ANALYST,
])

export type ProjectWriteFacts = {
    /** The caller owns the project outright. */
    is_owner: boolean
    /** A: the caller is an agency and the project's owner is one of its active clients. */
    owner_is_my_client: boolean
    /** B: the caller is active staff of an agency that owns the project. */
    staff_of_owning_agency: boolean
    /** C: the caller is active staff of an agency whose active client owns the project. */
    staff_of_agency_owning_client: boolean
    /** D: the role on the caller's own client seat with the project's owning agency, if any. */
    client_seat_role: string | null
}

/**
 * There are four ways to reach a project you do not own, and the rule used to recognise only
 * the last of them - so an agency owner or staff member could read a client's project and was
 * refused on every write. That failed closed, so nothing was exposed by it, but it broke the
 * workflow the product exists for: managing client workspaces on the client's behalf.
 *
 *   A. The caller is an agency and the project's owner is their client.       Allowed.
 *   B. The caller is staff of an agency that owns the project.                Staff roles.
 *   C. The caller is staff of an agency whose client owns the project.        Staff roles.
 *   D. The caller is a client of the agency that owns the project.            CLIENT_ADMIN only.
 *
 * A is safe to allow outright *because* AgencyClientLink is invitation-only: a link exists
 * only once the client has accepted one, so it carries their consent. When links could be
 * created unilaterally, this same rule would have handed an attacker write access to any
 * account whose email address they knew - which is the hole that moving client creation onto
 * invitations closed, and the reason this comment names the dependency rather than leaving a
 * future reader to rediscover it.
 *
 * Every branch is an allow-list. AgencyClientLink.role is an unconstrained String that
 * updateClientSettings writes without validation, so a typo, a role added later, or a
 * hand-edited row must not be able to grant anything. The previous version tested for
 * CLIENT_VIEWER and denied only that, which meant every other value granted write access.
 */
export function canWriteToProject(facts: ProjectWriteFacts): boolean {
    if (facts.is_owner) return true
    if (facts.owner_is_my_client) return true
    if (facts.staff_of_owning_agency) return true
    if (facts.staff_of_agency_owning_client) return true
    return facts.client_seat_role === "CLIENT_ADMIN"
}
