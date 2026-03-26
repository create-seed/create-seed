export interface RegistryTemplate {
  description: string
  id: string
  instructions?: string[]
  name: string
  path: string
}

export interface Registry {
  templates: RegistryTemplate[]
}

export interface ValidationError {
  message: string
  type: 'error' | 'warning'
}
