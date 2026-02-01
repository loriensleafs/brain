import { describe, expect, test } from "vitest";
import { createVectorConnection, verifySqliteVec } from "../connection";

describe("sqlite-vec connection", () => {
	test("loads sqlite-vec extension", () => {
		const db = createVectorConnection();
		const version = verifySqliteVec(db);
		expect(version).toBeTruthy();
		db.close();
	});
});
