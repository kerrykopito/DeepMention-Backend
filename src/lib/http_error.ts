/**
 * How a thrown error becomes an HTTP response.
 *
 * Controllers used to choose between 400 and 500 by searching for words inside the error
 * message. That check silently stopped working the moment a sentence was reworded, and it
 * did: a user hitting the one-workspace trial limit was told "Failed to create project"
 * with a 500, because the real sentence happened to contain none of the matched words.
 *
 * An error that carries a status states what kind of failure it is, so the wording is free
 * to change without moving the status code. This module holds the vocabulary for that and
 * nothing else; it has no runtime imports, so a plain `tsx` test can exercise the same
 * classification the controllers run.
 */

export type StatusCarryingError = Error & { status: number; code?: string }

/**
 * Builds the error shape this codebase already throws by hand in agency_service,
 * agency_access and project_access: an ordinary Error with the status the client should
 * receive attached to it. Preferred over a new error class per rule, because the
 * convention already exists and every generic handler here already understands it.
 *
 * The optional code is for failures whose user-facing sentence is chosen by the caller
 * rather than by the thrower - a mail provider being down reads differently on the
 * registration route than on the password reset route, and neither wants to show the
 * provider's own error text.
 */
export function httpError(status: number, message: string, code?: string): StatusCarryingError {
    const error = Object.assign(new Error(message), { status })
    return code ? Object.assign(error, { code }) : error
}

/** The attached status, but only when it is a status a response could actually carry. */
export function getErrorStatus(error: unknown): number | null {
    if (typeof error !== "object" || error === null || !("status" in error)) return null
    const status = Number((error as { status?: unknown }).status)
    return Number.isInteger(status) && status >= 400 && status <= 599 ? status : null
}

/** The attached machine code, which is never shown to a user and so is safe to compare. */
export function getErrorCode(error: unknown): string | null {
    if (typeof error !== "object" || error === null || !("code" in error)) return null
    const code = (error as { code?: unknown }).code
    return typeof code === "string" && code ? code : null
}

/**
 * project_access and agency_access throw these codes instead of sentences, so that each
 * route can name the resource it is about. Translating them in one place is what keeps a
 * machine code from reaching a client as though it were a message: the codes are tagged
 * 404 at the throw site, so a handler that merely honoured the status would answer
 * `{"error": "PROMPT_NOT_FOUND"}`. A Map rather than an object literal, because a lookup
 * by an arbitrary error message must not be able to find anything on Object.prototype.
 */
export const RESOURCE_NOT_FOUND_MESSAGES = new Map<string, string>([
    ["PROJECT_NOT_FOUND", "Project not found"],
    ["PROMPT_NOT_FOUND", "Prompt not found"],
    ["RUN_NOT_FOUND", "Run not found"],
    ["COMPETITOR_NOT_FOUND", "Competitor not found"],
])

export type ErrorResponse = {
    status: number
    /** What the client is told. Never the internal text of an unidentified failure. */
    message: string
    /**
     * True when nothing identified the error, so it is a genuine server fault: the caller
     * logs it and answers with its own fallback sentence rather than the error's own.
     */
    unexpected: boolean
}

/**
 * Decides the response for an error a controller caught, by what the error is rather than
 * by what it says. Three outcomes, in this order:
 *
 *  - a not-found code, which becomes the sentence for that resource;
 *  - anything carrying a 4xx, which is a deliberate rejection and keeps its own message;
 *  - anything else, which is a server fault: the fallback sentence, and the caller logs it.
 *
 * Only a 4xx releases the error's own message. A 5xx is something that went wrong on our
 * side, and its text - a mail provider's rejection, say - is for the log and not for the
 * client. A route that does want to word a particular 5xx for the user recognises it by its
 * code before asking this function, so that no later reordering of those branches can turn
 * an internal message into a response body.
 *
 * `fallbackStatus` exists only for the routes that already answered something other than
 * 500 to an unrecognised failure; preserving that is not an endorsement of it.
 */
export function resolveErrorResponse(
    error: unknown,
    fallback: string,
    options: { fallbackStatus?: number } = {},
): ErrorResponse {
    const message = error instanceof Error ? error.message : ""

    const notFoundMessage = RESOURCE_NOT_FOUND_MESSAGES.get(message)
    if (notFoundMessage) {
        return { status: getErrorStatus(error) ?? 404, message: notFoundMessage, unexpected: false }
    }

    const status = getErrorStatus(error)
    if (status !== null && status < 500) return { status, message, unexpected: false }

    return { status: options.fallbackStatus ?? 500, message: fallback, unexpected: true }
}

/**
 * Recognises "the database could not be reached". This is the one classification that
 * cannot be moved to the throw site, because nothing in this codebase throws it: it comes
 * out of Prisma, whose own code for an unreachable server is P1001. The message check is
 * kept behind the structural one deliberately - the pg adapter can surface the same
 * failure as a plain Error carrying no code at all, and answering 401 to a login that
 * never reached the database would tell the user their password was wrong when it was not.
 */
export function isDatabaseUnreachable(error: unknown): boolean {
    if (typeof error === "object" && error !== null) {
        const candidate = error as { code?: unknown; errorCode?: unknown; name?: unknown }
        if (candidate.code === "P1001" || candidate.errorCode === "P1001") return true
        if (candidate.name === "PrismaClientInitializationError") return true
    }

    const message = error instanceof Error ? error.message : ""
    return message.includes("Can't reach database")
        || message.includes("DatabaseNotReachable")
        || message.includes("P1001")
}
