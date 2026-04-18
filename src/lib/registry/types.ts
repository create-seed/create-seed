import type { CreateSeedToolRequirement } from '../create-seed-config.ts'

export interface RegistryTemplate {
  description: string
  id: string
  instructions?: string[]
  name: string
  path: string
  tools?: Record<string, CreateSeedToolRequirement>
}

export interface Registry {
  templates: RegistryTemplate[]
}

export interface ValidationError {
  message: string
  type: 'error' | 'warning'
}
