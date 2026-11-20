import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/;
const IGNORED_FOLDERS = ["src/assets/"];
const checkOnly = process.argv.includes("--check");

const ASSIGNMENT_OPERATORS = new Set([
	ts.SyntaxKind.EqualsToken,
	ts.SyntaxKind.PlusEqualsToken,
	ts.SyntaxKind.MinusEqualsToken,
	ts.SyntaxKind.AsteriskEqualsToken,
	ts.SyntaxKind.SlashEqualsToken,
	ts.SyntaxKind.PercentEqualsToken,
	ts.SyntaxKind.AsteriskAsteriskEqualsToken,
	ts.SyntaxKind.AmpersandEqualsToken,
	ts.SyntaxKind.BarEqualsToken,
	ts.SyntaxKind.CaretEqualsToken,
	ts.SyntaxKind.LessThanLessThanEqualsToken,
	ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
	ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
	ts.SyntaxKind.BarBarEqualsToken,
	ts.SyntaxKind.AmpersandAmpersandEqualsToken,
	ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

const INCREMENT_OPERATORS = new Set([
	ts.SyntaxKind.PlusPlusToken,
	ts.SyntaxKind.MinusMinusToken,
]);

function sourceFiles() {
	const listed = execFileSync(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard"],
		{ cwd: ROOT, encoding: "utf8" },
	);

	return listed
		.split("\n")
		.filter((file) => SOURCE_EXTENSIONS.test(file))
		.filter((file) => existsSync(path.join(ROOT, file)))
		.filter(
			(file) => !IGNORED_FOLDERS.some((folder) => file.startsWith(folder)),
		);
}

function scriptKind(file) {
	if (file.endsWith(".tsx")) {
		return ts.ScriptKind.TSX;
	}

	if (file.endsWith(".ts")) {
		return ts.ScriptKind.TS;
	}

	return ts.ScriptKind.JS;
}

function expressionKind(expression) {
	let inner = expression;

	while (ts.isParenthesizedExpression(inner)) {
		inner = inner.expression;
	}

	if (
		ts.isBinaryExpression(inner) &&
		ASSIGNMENT_OPERATORS.has(inner.operatorToken.kind)
	) {
		return "assignment";
	}

	if (
		(ts.isPrefixUnaryExpression(inner) || ts.isPostfixUnaryExpression(inner)) &&
		INCREMENT_OPERATORS.has(inner.operator)
	) {
		return "assignment";
	}

	if (ts.isStringLiteral(inner)) {
		return "directive";
	}

	return "call";
}

function statementKind(statement) {
	switch (statement.kind) {
		case ts.SyntaxKind.ImportDeclaration:
		case ts.SyntaxKind.ImportEqualsDeclaration:
			return "import";
		case ts.SyntaxKind.ExportDeclaration:
		case ts.SyntaxKind.ExportAssignment:
			return "export";
		case ts.SyntaxKind.VariableStatement:
			return "declaration";
		case ts.SyntaxKind.InterfaceDeclaration:
		case ts.SyntaxKind.TypeAliasDeclaration:
		case ts.SyntaxKind.EnumDeclaration:
		case ts.SyntaxKind.ModuleDeclaration:
			return "type";
		case ts.SyntaxKind.FunctionDeclaration:
			return "function";
		case ts.SyntaxKind.ClassDeclaration:
			return "class";
		case ts.SyntaxKind.ExpressionStatement:
			return expressionKind(statement.expression);
		case ts.SyntaxKind.ReturnStatement:
		case ts.SyntaxKind.ThrowStatement:
			return "exit";
		case ts.SyntaxKind.BreakStatement:
		case ts.SyntaxKind.ContinueStatement:
			return "loopExit";
		default:
			return "control";
	}
}

function memberKind(member) {
	return ts.isPropertyDeclaration(member) ||
		ts.isIndexSignatureDeclaration(member)
		? "property"
		: "method";
}

class SpacingPass {
	constructor(file, text) {
		this.text = text;

		this.source = ts.createSourceFile(
			file,
			text,
			ts.ScriptTarget.Latest,
			true,
			scriptKind(file),
		);

		this.insertions = new Set();
	}

	lineOf(position) {
		return this.source.getLineAndCharacterOfPosition(position).line;
	}

	spansLines(node) {
		return (
			this.lineOf(node.getStart(this.source)) !== this.lineOf(node.getEnd())
		);
	}

	statementsNeedBlank(previous, next) {
		const before = statementKind(previous);
		const after = statementKind(next);

		if (before === after && (before === "import" || before === "export")) {
			return false;
		}

		if (before === "directive" || after === "exit") {
			return true;
		}

		if (after === "loopExit") {
			return this.spansLines(previous);
		}

		if (this.spansLines(previous) || this.spansLines(next)) {
			return true;
		}

		return before !== after;
	}

	membersNeedBlank(previous, next) {
		if (this.spansLines(previous) || this.spansLines(next)) {
			return true;
		}

		return memberKind(previous) !== memberKind(next);
	}

	clauseIsLong(clause) {
		if (clause.statements.length === 0) {
			return false;
		}

		return (
			clause.statements.length > 1 || this.spansLines(clause.statements[0])
		);
	}

	separate(previous, next) {
		const between = this.text.slice(
			previous.getEnd(),
			next.getStart(this.source),
		);

		if (/\n[ \t]*\n/.test(between)) {
			return;
		}

		const newline = this.text.indexOf("\n", previous.getEnd());

		if (newline !== -1 && newline < next.getStart(this.source)) {
			this.insertions.add(newline);
		}
	}

	walk(nodes, needsBlank) {
		for (let index = 1; index < nodes.length; index += 1) {
			if (needsBlank(nodes[index - 1], nodes[index])) {
				this.separate(nodes[index - 1], nodes[index]);
			}
		}
	}

	visit(node) {
		if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) {
			this.walk(node.statements, (a, b) => this.statementsNeedBlank(a, b));
		} else if (ts.isCaseClause(node) || ts.isDefaultClause(node)) {
			this.walk(node.statements, (a, b) => this.statementsNeedBlank(a, b));
		} else if (ts.isCaseBlock(node)) {
			this.walk(node.clauses, (previous) => this.clauseIsLong(previous));
		} else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			this.walk(node.members, (a, b) => this.membersNeedBlank(a, b));
		}

		ts.forEachChild(node, (child) => this.visit(child));
	}

	run() {
		this.visit(this.source);

		let output = this.text;

		for (const position of [...this.insertions].sort((a, b) => b - a)) {
			output = `${output.slice(0, position)}\n${output.slice(position)}`;
		}

		return { output, added: this.insertions.size };
	}
}

const pending = [];

for (const file of sourceFiles()) {
	const absolute = path.join(ROOT, file);

	const { output, added } = new SpacingPass(
		file,
		readFileSync(absolute, "utf8"),
	).run();

	if (added === 0) {
		continue;
	}

	pending.push(`${file} (${added})`);

	if (!checkOnly) {
		writeFileSync(absolute, output);
	}
}

if (checkOnly && pending.length > 0) {
	console.error(
		`Lignes vides manquantes, lancez « npm run format » :\n${pending.join("\n")}`,
	);

	process.exitCode = 1;
} else {
	console.log(
		pending.length === 0
			? "Espacement du code conforme."
			: `Lignes vides ajoutées dans ${pending.length} fichier(s).`,
	);
}
