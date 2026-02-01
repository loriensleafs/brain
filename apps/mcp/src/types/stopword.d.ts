/**
 * Type declarations for stopword package
 *
 * The stopword package doesn't include TypeScript declarations,
 * so we provide minimal type coverage for the functions we use.
 */

declare module "stopword" {
	/**
	 * Remove stopwords from an array of strings
	 */
	export function removeStopwords(input: string[]): string[];
}
