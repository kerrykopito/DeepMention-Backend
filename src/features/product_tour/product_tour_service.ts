import prisma from "../../lib/prisma"
import type { ProductTourStatus } from "./product_tour_types"
import { httpError } from "../../lib/http_error"

export async function getProductTourStatus(userId: string): Promise<ProductTourStatus> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            product_tour_completed: true,
            product_tour_completed_at: true,
        },
    })

    if (!user) {
        throw httpError(404, "User not found")
    }

    return {
        completed: user.product_tour_completed,
        completed_at: user.product_tour_completed_at,
    }
}

export async function completeProductTour(userId: string): Promise<ProductTourStatus> {
    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            product_tour_completed: true,
            product_tour_completed_at: new Date(),
        },
        select: {
            product_tour_completed: true,
            product_tour_completed_at: true,
        },
    })

    return {
        completed: user.product_tour_completed,
        completed_at: user.product_tour_completed_at,
    }
}

