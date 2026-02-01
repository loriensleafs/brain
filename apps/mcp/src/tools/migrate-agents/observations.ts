/**
 * Observation generator for transforming .agents/ content to basic-memory format
 *
 * Extracts key facts, decisions, and insights from markdown content
 * and formats them as categorized observations with tags.
 */

import { parseListItems, parseMarkdownTable } from "./parser";
import type {
	Observation,
	ObservationCategory,
	ParsedAgentFile,
} from "./schema";
import { QUALITY_THRESHOLDS } from "./schema";

/**
 * Generate observations from parsed agent file
 *
 * Applies entity-type-specific extraction strategies
 */
export function generateObservations(parsed: ParsedAgentFile): Observation[] {
	const observations: Observation[] = [];

	// Apply entity-specific extraction
	switch (parsed.entityType) {
		case "session":
			observations.push(...extractSessionObservations(parsed));
			break;
		case "decision":
			observations.push(...extractDecisionObservations(parsed));
			break;
		case "requirement":
			observations.push(...extractRequirementObservations(parsed));
			break;
		case "design":
			observations.push(...extractDesignObservations(parsed));
			break;
		case "task":
			observations.push(...extractTaskObservations(parsed));
			break;
		case "security":
			observations.push(...extractSecurityObservations(parsed));
			break;
		default:
			observations.push(...extractGenericObservations(parsed));
	}

	// Ensure minimum observations
	if (observations.length < QUALITY_THRESHOLDS.minObservations) {
		observations.push(...fillMinimumObservations(parsed, observations.length));
	}

	// Limit to maximum
	return observations.slice(0, QUALITY_THRESHOLDS.maxObservations);
}

/**
 * Extract observations from session logs
 */
function extractSessionObservations(parsed: ParsedAgentFile): Observation[] {
	const observations: Observation[] = [];
	const sections = parsed.sections;
	const fm = parsed.originalFrontmatter;

	// Extract session metadata
	if (fm.Branch || fm.branch) {
		observations.push({
			category: "fact",
			content: `Session work on branch ${fm.Branch || fm.branch}`,
			tags: ["session", "git"],
		});
	}

	// Extract from Objective section
	const objective = sections.get("Objective") || sections.get("Session Info");
	if (objective) {
		observations.push({
			category: "fact",
			content: extractFirstSentence(objective),
			tags: ["objective", "session"],
		});
	}

	// Extract decisions from Work Log or Decisions Made
	const workLog = sections.get("Work Log") || sections.get("Decisions Made");
	if (workLog) {
		const decisions = extractDecisionStatements(workLog);
		for (const decision of decisions.slice(0, 3)) {
			observations.push({
				category: "decision",
				content: decision,
				tags: ["session-decision"],
			});
		}
	}

	// Extract from Key Findings
	const findings = sections.get("Key Findings") || sections.get("Findings");
	if (findings) {
		const items = parseListItems(findings);
		for (const item of items.slice(0, 3)) {
			observations.push({
				category: "insight",
				content: item,
				tags: ["finding"],
			});
		}
	}

	// Extract from Lessons Learned
	const lessons =
		sections.get("Lessons Learned") || sections.get("Notes for Next Session");
	if (lessons) {
		const items = parseListItems(lessons);
		for (const item of items.slice(0, 2)) {
			observations.push({
				category: "insight",
				content: item,
				tags: ["lesson"],
			});
		}
	}

	// Extract outcome from summary
	const outcome = extractOutcome(parsed.content);
	if (outcome) {
		observations.push({
			category: "outcome",
			content: outcome,
			tags: ["session-outcome"],
		});
	}

	return observations;
}

/**
 * Extract observations from ADRs/decisions
 */
function extractDecisionObservations(parsed: ParsedAgentFile): Observation[] {
	const observations: Observation[] = [];
	const sections = parsed.sections;
	const fm = parsed.originalFrontmatter;

	// Extract status
	if (fm.status) {
		observations.push({
			category: "fact",
			content: `Decision status: ${fm.status}`,
			tags: ["adr", "status"],
		});
	}

	// Extract context
	const context = sections.get("Context") || sections.get("Problem");
	if (context) {
		observations.push({
			category: "problem",
			content: extractFirstSentence(context),
			tags: ["adr", "context"],
		});
	}

	// Extract decision
	const decision = sections.get("Decision") || sections.get("Solution");
	if (decision) {
		observations.push({
			category: "decision",
			content: extractFirstSentence(decision),
			tags: ["adr", "decision"],
		});
	}

	// Extract consequences/rationale
	const consequences =
		sections.get("Consequences") || sections.get("Rationale");
	if (consequences) {
		const items = parseListItems(consequences);
		for (const item of items.slice(0, 2)) {
			observations.push({
				category: "insight",
				content: item,
				tags: ["adr", "consequence"],
			});
		}
	}

	// Extract alternatives considered
	const alternatives =
		sections.get("Alternatives Considered") || sections.get("Options");
	if (alternatives) {
		observations.push({
			category: "fact",
			content: `Alternatives evaluated: ${summarizeAlternatives(alternatives)}`,
			tags: ["adr", "alternatives"],
		});
	}

	return observations;
}

/**
 * Extract observations from requirements
 */
function extractRequirementObservations(
	parsed: ParsedAgentFile,
): Observation[] {
	const observations: Observation[] = [];
	const sections = parsed.sections;
	const fm = parsed.originalFrontmatter;

	// Extract requirement statement
	const reqStatement =
		sections.get("Requirement Statement") || sections.get("Description");
	if (reqStatement) {
		observations.push({
			category: "requirement",
			content: extractFirstSentence(reqStatement),
			tags: ["requirement", "statement"],
		});
	}

	// Extract priority
	if (fm.priority) {
		observations.push({
			category: "fact",
			content: `Priority: ${fm.priority}`,
			tags: ["requirement", "priority"],
		});
	}

	// Extract acceptance criteria
	const criteria = sections.get("Acceptance Criteria");
	if (criteria) {
		const items = parseListItems(criteria);
		for (const item of items.slice(0, 3)) {
			observations.push({
				category: "requirement",
				content: item.replace(/^\[[ x]\]\s*/, ""),
				tags: ["acceptance-criteria"],
			});
		}
	}

	// Extract dependencies
	const deps = sections.get("Dependencies");
	if (deps) {
		const items = parseListItems(deps);
		for (const item of items.slice(0, 2)) {
			observations.push({
				category: "fact",
				content: `Depends on: ${item}`,
				tags: ["dependency"],
			});
		}
	}

	return observations;
}

/**
 * Extract observations from design documents
 */
function extractDesignObservations(parsed: ParsedAgentFile): Observation[] {
	const observations: Observation[] = [];
	const sections = parsed.sections;

	// Extract design overview
	const overview = sections.get("Design Overview") || sections.get("Overview");
	if (overview) {
		observations.push({
			category: "fact",
			content: extractFirstSentence(overview),
			tags: ["design", "overview"],
		});
	}

	// Extract component descriptions
	for (const [name, content] of sections) {
		if (name.startsWith("Component")) {
			observations.push({
				category: "fact",
				content: extractFirstSentence(content),
				tags: ["design", "component"],
			});
		}
	}

	// Extract technology decisions
	const techDecisions = sections.get("Technology Decisions");
	if (techDecisions) {
		const tableData = parseMarkdownTable(techDecisions);
		for (const [key, value] of tableData) {
			if (key && value && !key.includes("-")) {
				observations.push({
					category: "decision",
					content: `${key}: ${value}`,
					tags: ["design", "technology"],
				});
			}
		}
	}

	// Extract security considerations
	const security = sections.get("Security Considerations");
	if (security) {
		observations.push({
			category: "requirement",
			content: extractFirstSentence(security),
			tags: ["design", "security"],
		});
	}

	return observations;
}

/**
 * Extract observations from task documents
 */
function extractTaskObservations(parsed: ParsedAgentFile): Observation[] {
	const observations: Observation[] = [];
	const sections = parsed.sections;
	const fm = parsed.originalFrontmatter;

	// Extract task description
	const desc = sections.get("Description") || sections.get("Task");
	if (desc) {
		observations.push({
			category: "fact",
			content: extractFirstSentence(desc),
			tags: ["task", "description"],
		});
	}

	// Extract status
	if (fm.status) {
		observations.push({
			category: "fact",
			content: `Task status: ${fm.status}`,
			tags: ["task", "status"],
		});
	}

	// Extract implementation notes
	const impl =
		sections.get("Implementation") || sections.get("Implementation Notes");
	if (impl) {
		const items = parseListItems(impl);
		for (const item of items.slice(0, 2)) {
			observations.push({
				category: "technique",
				content: item,
				tags: ["task", "implementation"],
			});
		}
	}

	return observations;
}

/**
 * Extract observations from security documents
 */
function extractSecurityObservations(parsed: ParsedAgentFile): Observation[] {
	const observations: Observation[] = [];
	const sections = parsed.sections;

	// Extract findings
	const findings =
		sections.get("Findings") || sections.get("Security Findings");
	if (findings) {
		const items = parseListItems(findings);
		for (const item of items.slice(0, 3)) {
			observations.push({
				category: "problem",
				content: item,
				tags: ["security", "finding"],
			});
		}
	}

	// Extract remediation
	const remediation =
		sections.get("Remediation") || sections.get("Remediation Approach");
	if (remediation) {
		observations.push({
			category: "solution",
			content: extractFirstSentence(remediation),
			tags: ["security", "remediation"],
		});
	}

	// Extract risk assessment
	const risk = sections.get("Risk Assessment") || sections.get("Risk");
	if (risk) {
		observations.push({
			category: "insight",
			content: extractFirstSentence(risk),
			tags: ["security", "risk"],
		});
	}

	return observations;
}

/**
 * Extract generic observations from any document type
 */
function extractGenericObservations(parsed: ParsedAgentFile): Observation[] {
	const observations: Observation[] = [];

	// Extract from first few list items in content
	const items = parseListItems(parsed.content);
	for (const item of items.slice(0, 4)) {
		const category = categorizeStatement(item);
		observations.push({
			category,
			content: item,
			tags: [parsed.entityType],
		});
	}

	// Extract from any section that looks like a summary
	const summarySection =
		parsed.sections.get("Summary") ||
		parsed.sections.get("Overview") ||
		parsed.sections.get("Description");

	if (summarySection) {
		observations.push({
			category: "fact",
			content: extractFirstSentence(summarySection),
			tags: [parsed.entityType, "summary"],
		});
	}

	return observations;
}

/**
 * Fill minimum observations when extraction yielded too few
 */
function fillMinimumObservations(
	parsed: ParsedAgentFile,
	currentCount: number,
): Observation[] {
	const needed = QUALITY_THRESHOLDS.minObservations - currentCount;
	if (needed <= 0) return [];

	const observations: Observation[] = [];

	// Add title as a fact
	observations.push({
		category: "fact",
		content: `Document: ${parsed.title}`,
		tags: [parsed.entityType],
	});

	// Add entity type observation
	if (observations.length < needed) {
		observations.push({
			category: "fact",
			content: `Type: ${parsed.entityType} document`,
			tags: ["metadata"],
		});
	}

	// Extract first paragraph as context
	if (observations.length < needed) {
		const firstPara = extractFirstParagraph(parsed.content);
		if (firstPara) {
			observations.push({
				category: "fact",
				content: firstPara,
				tags: [parsed.entityType, "context"],
			});
		} else {
			// Fallback: add source path as observation
			observations.push({
				category: "fact",
				content: `Source: ${parsed.relativePath}`,
				tags: ["metadata", "source"],
			});
		}
	}

	return observations.slice(0, needed);
}

/**
 * Extract first sentence from text
 */
function extractFirstSentence(text: string): string {
	// Remove markdown formatting
	const cleaned = text
		.replace(/^#+\s*/gm, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.trim();

	// Find first sentence
	const match = cleaned.match(/^[^.!?]+[.!?]/);
	if (match) {
		return match[0].trim();
	}

	// Return first 150 chars if no sentence found
	return cleaned.slice(0, 150).trim();
}

/**
 * Extract first paragraph from text
 */
function extractFirstParagraph(text: string): string {
	const paragraphs = text.split(/\n\n+/);
	for (const para of paragraphs) {
		const cleaned = para.trim();
		// Skip headings, code blocks, lists
		if (
			cleaned &&
			!cleaned.startsWith("#") &&
			!cleaned.startsWith("```") &&
			!cleaned.startsWith("-") &&
			!cleaned.startsWith("*")
		) {
			return cleaned.slice(0, 200);
		}
	}
	return "";
}

/**
 * Extract outcome statement from content
 */
function extractOutcome(content: string): string | null {
	// Look for outcome indicators
	const patterns = [
		/\*\*Outcome\*\*:\s*(.+)/i,
		/\*\*Result\*\*:\s*(.+)/i,
		/\*\*Status\*\*:\s*(Success|Complete|Done|PASS).*/i,
		/Session.*completed.*successfully/i,
	];

	for (const pattern of patterns) {
		const match = content.match(pattern);
		if (match) {
			return match[1] || match[0];
		}
	}

	return null;
}

/**
 * Extract decision statements from text
 */
function extractDecisionStatements(text: string): string[] {
	const decisions: string[] = [];

	// Look for explicit decision markers
	const patterns = [
		/(?:Decided|Decision|Chose|Selected|Went with)[:\s]+(.+)/gi,
		/\*\*Decision\*\*[:\s]+(.+)/gi,
		/- \[decision\][:\s]+(.+)/gi,
	];

	for (const pattern of patterns) {
		let match;
		while ((match = pattern.exec(text)) !== null) {
			decisions.push(match[1].trim());
		}
	}

	return decisions;
}

/**
 * Summarize alternatives from text
 */
function summarizeAlternatives(text: string): string {
	const items = parseListItems(text);
	if (items.length === 0) return "multiple options";
	if (items.length <= 3) return items.join(", ");
	return `${items.slice(0, 3).join(", ")}, and ${items.length - 3} more`;
}

/**
 * Categorize a statement based on content
 */
function categorizeStatement(statement: string): ObservationCategory {
	const lower = statement.toLowerCase();

	if (
		lower.includes("decided") ||
		lower.includes("chose") ||
		lower.includes("selected")
	) {
		return "decision";
	}
	if (
		lower.includes("must") ||
		lower.includes("shall") ||
		lower.includes("required")
	) {
		return "requirement";
	}
	if (
		lower.includes("issue") ||
		lower.includes("problem") ||
		lower.includes("bug")
	) {
		return "problem";
	}
	if (
		lower.includes("fixed") ||
		lower.includes("resolved") ||
		lower.includes("solution")
	) {
		return "solution";
	}
	if (
		lower.includes("learned") ||
		lower.includes("insight") ||
		lower.includes("realized")
	) {
		return "insight";
	}
	if (
		lower.includes("use") ||
		lower.includes("approach") ||
		lower.includes("method")
	) {
		return "technique";
	}

	return "fact";
}
