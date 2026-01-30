import { ITool } from "./core/ITool";
import { BashTool } from "./tools/BashTool";

export class ToolRegistry {
    private tools: Map<string, ITool> = new Map();

    constructor() {
        this.register(new BashTool());
        // Future: this.register(new GitTool());
    }

    register(tool: ITool) {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): ITool | undefined {
        return this.tools.get(name);
    }

    getAllTools(): ITool[] {
        return Array.from(this.tools.values());
    }

    // Generate tool definitions for the LLM System Prompt
    getToolDefinitions(): string {
        return Array.from(this.tools.values()).map(tool => {
            return `
- Name: ${tool.name}
  Description: ${tool.description}
  Schema: ${JSON.stringify(generateJsonSchema(tool.schema))}
            `.trim();
        }).join("\n\n");
    }
}

// Helper to convert Zod to simplified JSON schema for the prompt
function generateJsonSchema(schema: any): any {
    // Very basic zod-to-json logic for prompt consumption
    // In production, use zod-to-json-schema package
    // For now, we rely on the description + key names
    if (schema._def?.typeName === "ZodObject") {
        const shape = schema.shape;
        const props: any = {};
        for (const key in shape) {
            props[key] = {
                type: shape[key]._def.typeName.replace('Zod', '').toLowerCase(),
                description: shape[key].description
            };
        }
        return props;
    }
    return "object";
}

export const toolRegistry = new ToolRegistry();
