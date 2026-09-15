import assert from "node:assert/strict"
import { canWriteToProject, type ProjectWriteFacts } from "./project_write_policy"

/**
 * Write access to someone else's project.
 *
 * Two bugs have already lived in this rule, one in each direction, which is why it is pinned
 * here rather than left to a reviewer's eye:
 *
 *   It tested for CLIENT_VIEWER and denied only that, so every other value in an
 *   unconstrained String column - a typo, a role added later, the unvalidated role
 *   updateClientSettings writes - granted write access.
 *
 *   Inverting it to an allow-list fixed that and recognised only the client-of-agency
 *   direction, so an agency could read a client's project and was refused every write. That
 *   failed closed, but it broke the workflow the product exists for.
 *
 * The cases below name all four ways to reach a project you do not own, so that changing any
 * one of them is a deliberate edit with a failing test attached.
 */

function facts(overrides: Partial<ProjectWriteFacts> = {}): ProjectWriteFacts {
    return {
        is_owner: false,
        owner_is_my_client: false,
        staff_of_owning_agency: false,
        staff_of_agency_owning_client: false,
        client_seat_role: null,
        ...overrides,
    }
}

// ── Denied by default ────────────────────────────────────────────────────────

// A caller with no relationship at all. assertProjectAccess would not have let them this far,
// but the rule must not depend on that to be safe.
assert.equal(canWriteToProject(facts()), false, "a stranger must not write")

// ── The owner ────────────────────────────────────────────────────────────────

assert.equal(canWriteToProject(facts({ is_owner: true })), true)

// ── A: the caller is an agency, the project's owner is their client ───────────

// This is the direction that was broken. It is safe to allow outright only because
// AgencyClientLink is invitation-only now - the link carries the client's consent.
assert.equal(canWriteToProject(facts({ owner_is_my_client: true })), true)

// ── B and C: agency staff ────────────────────────────────────────────────────

assert.equal(canWriteToProject(facts({ staff_of_owning_agency: true })), true)
assert.equal(canWriteToProject(facts({ staff_of_agency_owning_client: true })), true)

// ── D: a client seat, which is the one direction with a role test ────────────

assert.equal(canWriteToProject(facts({ client_seat_role: 'CLIENT_ADMIN' })), true)
assert.equal(canWriteToProject(facts({ client_seat_role: 'CLIENT_VIEWER' })), false)

// An allow-list, not a deny-list: anything that is not exactly CLIENT_ADMIN is refused. These
// are the shapes an unconstrained String column actually produces.
for (const role of [
    'client_admin',          // wrong case
    'CLIENT_ADMIN ',         // trailing space
    ' CLIENT_ADMIN',
    'CLIENT_ADMINISTRATOR',  // a longer role added later
    'ADMIN',
    'OWNER',
    'MANAGER',
    'ANALYST',
    '',
    'undefined',
    'null',
]) {
    assert.equal(
        canWriteToProject(facts({ client_seat_role: role })),
        false,
        `client seat role ${JSON.stringify(role)} must not grant write access`,
    )
}

// A client seat that cannot write is not rescued by being a viewer somewhere else, and a
// viewer seat does not veto a grant the caller holds by another route - each branch stands on
// its own, which is what makes this an allow-list.
assert.equal(canWriteToProject(facts({ client_seat_role: 'CLIENT_VIEWER', owner_is_my_client: true })), true)
assert.equal(canWriteToProject(facts({ client_seat_role: 'CLIENT_VIEWER', staff_of_owning_agency: true })), true)

// ── Nothing else opens the door ──────────────────────────────────────────────

// Every false-by-default fact left false must keep the answer false, so that adding a new
// fact to the type cannot accidentally become a grant.
assert.equal(canWriteToProject(facts({ client_seat_role: 'CLIENT_VIEWER' })), false)

console.log("Project write access checks passed.")
