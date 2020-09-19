import ts from 'typescript';

export default (program: ts.Program, config?: Record<string, unknown>): ts.TransformerFactory<ts.Node> => (context) => (bundle) => {
	let checker = program.getTypeChecker();

	function visitor(node: ts.Node): ts.Node | undefined {
		switch (node.kind) {
			case ts.SyntaxKind.EnumDeclaration:
				let enumNode = node as ts.EnumDeclaration;
				if (ts.getCombinedModifierFlags(enumNode) & ts.ModifierFlags.Const) {
					return ts.createVariableStatement(enumNode.modifiers, ts.createVariableDeclarationList([
						ts.createVariableDeclaration(enumNode.name, undefined, ts.createObjectLiteral(
							enumNode.members.map(member => ts.createPropertyAssignment(
								member.name,
								ts.createLiteral(checker.getConstantValue(member))
							))
						)),
					], ts.NodeFlags.Const));
				}

				return node;
			default:
				return ts.visitEachChild(node, visitor, context);
		}
	}

	return ts.visitNode(bundle, visitor);
};