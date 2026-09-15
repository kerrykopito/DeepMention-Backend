import { Request, Response } from 'express'
import { researchbrand, promptgeneration, createProject } from './onboarding_service'
import type { AuthenticatedRequest } from '../../middleware/auth'
import { resolveErrorResponse } from '../../lib/http_error'
import { z } from 'zod'

const onboardingPromptSchema = z.object({
    topic: z.string().trim().min(2).max(80),
    type: z.string().trim().min(2).max(80),
    text: z.string().trim().min(8).max(500),
    selected: z.boolean(),
    source: z.enum(['GENERATED', 'CUSTOMER']).optional(),
})

const onboardingEngineSchema = z.array(z.string().trim().min(2).max(40)).min(1).max(5)

export const researchBrandController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { brand_name, brand_url } = req.body
        if (!brand_name || !brand_url) {
            res.status(400).json({ error: 'brand_name and brand_url are required' })
            return
        }

        const result = await researchbrand({ brand_name, brand_url })
        res.status(200).json(result)
    } catch (error) {
        console.error('Brand research failed', error)
        res.status(500).json({
            error: 'Failed to research brand',
            detail: process.env.NODE_ENV === 'production'
                ? undefined
                : error instanceof Error ? error.message : 'Unknown error',
        })
    }
}

export const generatePromptsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { brand_name, brand_url, brand_data } = req.body
        if (!brand_name || !brand_url || !brand_data) {
            res.status(400).json({ error: 'brand_name, brand_url, and brand_data are required' })
            return
        }

        const result = await promptgeneration({ brand_name, brand_url, brand_data })
        res.status(200).json(result)
    } catch (error) {
        console.error('Prompt generation failed', error)
        res.status(500).json({
            error: 'Failed to generate prompts',
            detail: process.env.NODE_ENV === 'production'
                ? undefined
                : error instanceof Error ? error.message : 'Unknown error',
        })
    }
}

export const createProjectController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { brand_name, brand_url, brand_location, competitors } = req.body
        const parsedPrompts = z.array(onboardingPromptSchema).min(1).max(500).safeParse(req.body.prompts)
        const parsedEngines = onboardingEngineSchema.safeParse(req.body.engines)
        const user_id = (req as AuthenticatedRequest).user.id

        const missing_fields = [
            !brand_name ? 'brand_name' : null,
            !brand_url ? 'brand_url' : null,
            !brand_location ? 'brand_location' : null,
            !parsedPrompts.success ? 'prompts' : null,
            !parsedEngines.success ? 'engines' : null
        ].filter(Boolean)

        if (missing_fields.length > 0) {
            res.status(400).json({
                error: 'Missing required fields for project creation',
                missing_fields
            })
            return
        }

        const project = await createProject({
            user_id,
            brand_name,
            brand_url,
            brand_location,
            competitors: competitors || [],
            engines: parsedEngines.success ? parsedEngines.data : [],
            prompts: parsedPrompts.success ? parsedPrompts.data : []
        })

        res.status(201).json(project)
    } catch (error) {
        // A plan limit is a decision of the product, not a server fault, so the user gets the
        // real sentence and can act on it instead of seeing "Failed to create project". The
        // substring list that used to follow this branch is gone: the engine and validation
        // paths now carry their own status, which is what that comment was waiting for.
        const { status, message, unexpected } = resolveErrorResponse(error, 'Failed to create project')
        if (unexpected) {
            console.error("[onboarding_controller:createProject]", error)
        }
        res.status(status).json({ error: message })
    }
}
