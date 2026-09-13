import dns from 'dns'
import net from 'net'

export class BlockedUrlError extends Error {}

function isBlockedIpv4(ip: string): boolean {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local, incl. cloud metadata at 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
    if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
    if (a === 192 && b === 0) return true // IETF protocol assignments / TEST-NET-1
    if (a >= 224) return true // multicast and reserved
    return false
}

function isBlockedIpv6(ip: string): boolean {
    const lower = ip.toLowerCase()
    if (lower === '::' || lower === '::1') return true
    if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isBlockedIpv4(mapped[1])
    return false
}

function isBlockedAddress(ip: string): boolean {
    const version = net.isIP(ip)
    if (version === 4) return isBlockedIpv4(ip)
    if (version === 6) return isBlockedIpv6(ip)
    return true
}

/**
 * Resolves a user-supplied URL and rejects anything pointing inside the network the
 * server sits in. Without this, "https://my-brand.com" can redirect to the cloud
 * metadata endpoint and the crawled body hands back instance credentials.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        throw new BlockedUrlError('That does not look like a valid website address.')
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new BlockedUrlError('Only http and https addresses can be crawled.')
    }

    const host = url.hostname.replace(/^\[|\]$/g, '')

    if (net.isIP(host)) {
        if (isBlockedAddress(host)) throw new BlockedUrlError('That address is not publicly reachable.')
        return url
    }

    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
        throw new BlockedUrlError('That address is not publicly reachable.')
    }

    let resolved: { address: string }[]
    try {
        resolved = await dns.promises.lookup(host, { all: true })
    } catch {
        throw new BlockedUrlError('That website address could not be resolved.')
    }

    if (resolved.length === 0 || resolved.some(entry => isBlockedAddress(entry.address))) {
        throw new BlockedUrlError('That address is not publicly reachable.')
    }

    return url
}
