import {
  compareVersions,
  inspectToolVersion,
  isValidToolVersion,
  parseVersion,
  type ToolVersionInspectionResult,
  type ToolVersionProbe,
} from './assert-template-tools.ts'
import { isValidRegexPattern } from './create-seed-config.ts'

interface SuggestedToolConfigValue {
  args?: string[]
  minVersion?: string
  versionPattern?: string
}

export interface ProbeToolOptions {
  args?: string[]
  minVersion?: string
  presenceOnly?: boolean
  probe?: ToolVersionProbe
  versionPattern?: string
}

export interface ProbeToolResult extends ToolVersionInspectionResult {
  minVersion: string | undefined
  satisfiesMinVersion: boolean | undefined
  suggestedConfig:
    | {
        tools: Record<string, SuggestedToolConfigValue | string>
      }
    | undefined
}

function buildSuggestedConfig(command: string, inspection: ToolVersionInspectionResult, options: ProbeToolOptions) {
  const hasCustomArgs = options.args !== undefined && !(options.args.length === 1 && options.args[0] === '--version')

  if (options.presenceOnly) {
    const value: SuggestedToolConfigValue = {}

    if (hasCustomArgs) {
      value.args = options.args
    }

    return {
      tools: {
        [command]: value,
      },
    }
  }

  const minVersion = options.minVersion ?? inspection.version

  if (!minVersion) {
    return undefined
  }

  if (!hasCustomArgs && !options.versionPattern) {
    return {
      tools: {
        [command]: minVersion,
      },
    }
  }

  const value: SuggestedToolConfigValue = {
    minVersion,
  }

  if (hasCustomArgs) {
    value.args = options.args
  }

  if (options.versionPattern) {
    value.versionPattern = options.versionPattern
  }

  return {
    tools: {
      [command]: value,
    },
  }
}

export async function probeTool(command: string, options: ProbeToolOptions = {}): Promise<ProbeToolResult> {
  if (options.minVersion !== undefined && !isValidToolVersion(options.minVersion)) {
    throw new Error(`Invalid minimum version: "${options.minVersion}". Expected a version like "1.2.3"`)
  }

  if (options.versionPattern !== undefined && !isValidRegexPattern(options.versionPattern)) {
    throw new Error(`Invalid version pattern: "${options.versionPattern}". Expected a valid regular expression`)
  }

  if (options.presenceOnly && options.minVersion) {
    throw new Error('presenceOnly cannot be combined with minVersion')
  }

  if (options.presenceOnly && options.versionPattern) {
    throw new Error('presenceOnly cannot be combined with versionPattern')
  }

  const inspection = await inspectToolVersion(
    {
      args: options.args ?? ['--version'],
      command,
      versionPattern: options.versionPattern,
    },
    { probe: options.probe },
  )

  const result =
    options.presenceOnly && inspection.status === 'unparseable'
      ? {
          ...inspection,
          status: 'ok' as const,
        }
      : inspection

  const satisfiesMinVersion =
    options.minVersion && result.version
      ? compareVersions(parseVersion(result.version), parseVersion(options.minVersion)) >= 0
      : undefined

  return {
    ...result,
    minVersion: options.minVersion,
    satisfiesMinVersion,
    suggestedConfig: buildSuggestedConfig(command, result, options),
  }
}
