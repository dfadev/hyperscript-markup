import template from "babel-template";
import * as t from "babel-types";
import generate from "babel-generator";
import * as babylon from "babylon";
import traverse from "babel-traverse";

export default function({ types: t }) {
	return {
		visitor: {
			BinaryExpression(path) {

				if (path.node.operator != "<<") { return; }
				let functionPrefix = t.memberExpression(t.identifier("React"), t.identifier("createElement"));
				if (t.isIdentifier(path.node.left)) {
					let nm = path.node.left.name;
					if (nm[0] != "$" || nm[1] != "$") return;
					if (nm.length > 2)
						functionPrefix = t.identifier(nm.substring(2));

				} else if (t.isMemberExpression(path.node.left)) {
					var clean = generate(path.node.left, { comments: false });
					
					let nm = clean.code;
					if (nm[0] != "$" || nm[1] != "$") return;
					if (nm.length > 2)
						functionPrefix = babylon.parseExpression(nm.substring(2));
				}

				path.replaceWith(
					createExpr(
						orderBlocks(parseCalls(path.node.right)),
						functionPrefix
					)
				);
			}
		}
	};
};

function parseCalls(path) {
	switch(path.type) {
		case "CallExpression":
			if ( (path.callee.extra && path.callee.extra.parenthesized) ||
				 (path.callee.type == "CallExpression") ) {
				let b1 = parseCalls(path.callee);
				let b2 = chainElement(path.arguments[0]);
				return [b2].concat(b1);
			} else {
				let b = chainElement(path);
				return [b];
			}

		case "MemberExpression":
			if (path.object.extra && path.object.extra.parenthesized && path.property.type != "SequenceExpression") {
				let b1 = parseCalls(path.object);
				let b2 = chainElement(path.property);
				return [b2].concat(b1);
			} else {
				let b = chainElement(path);
				return [b];
			}
			break;

		case "ArrayExpression":
			let expr = [];
			for (let element of path.elements) {
				let block = {
					path: element,
					type: "ExprBlock",
				};
				expr.push(block);
			}
			expr.reverse();
			return expr;
			break;

		case "ArrowFunctionExpression":
		case "UnaryExpression":
		case "BinaryExpression":
		case "Identifier":
			let b = chainElement(path);
			return [b];
			break;

		default:
			throw 'parseCalls unknown node type: ' + path.type;

	}
}

function chainElement(path) {
	var element = {
			path: path,
			type: 'ElementBlock',
			selector: {
				tag: '',
				classes: [],
				id: '',
			},
			attributes: null,
			inlineAttributes: [],
			content: null
		};

	switch (path.type) {
		case "Identifier": // (div), (Component)
			if (path.name == "$else") {
				element.type = "Else";
			} else {
				element.selector.tag = path.name;
				if (path.name[0] === path.name[0].toUpperCase()) {
					element.type = 'CustomElement';
					element.arguments = [];
				} else {
					element.type = 'ElementBlock';
				}
			}
			break;
		
		case "BinaryExpression": // (div+id), (div-id), (div+id.css), (Component+id.css)
			if (path.operator == "+" || path.operator == "-") {
				let block = chainElement(path.right);
				element.attributes = block.attributes;
				parseEndBlock(path, element);
			} else if (path.operator == ">") {
				element = chainElement(path.left);
				element.content = path.right;
			} else if (path.operator == ">>") {
				element.type = 'NullMap';
			} else throw "binary expression parse error";
			break;

		case "ArrowFunctionExpression":
			element.type = 'Map';
			break;

		case "MemberExpression": // id.css.css.css
			parseEndBlock(path, element);
			break;

		case "CallExpression": // (div(param=p))
			let foundDirective = false;
			if (path.callee.type == "Identifier") {
				switch (path.callee.name) {
					case "$if":
						element.type = "If";
						element.condition = path.arguments[0];
						foundDirective = true;
						break;
					case "$elseif":
						element.type = "ElseIf";
						element.condition = path.arguments[0];
						foundDirective = true;
						break;
				}
			} 
			if (!foundDirective) {
				element = chainElement(path.callee);
				element.attributes = extractAttributes(path.arguments);
			}
			break;

		case "ArrayExpression":
		case "TemplateLiteral":
		case "StringLiteral":
			element.type = "ExprBlock";
			break;

		case "UnaryExpression":
			if (path.operator != "~") throw "invalid UnaryExpression";
			element.type = "TildeElement";
			break;

		default:
			throw "chainElement unknown node type: " + path.type;
	}

	return element;

}

function orderBlocks(blocks) {
	blocks.reverse();
	var list = [];
	var current = null;
	var lines = new Map();
	for (let block of blocks) {
		let line = block.path.loc.start.line;
		if (!lines.has(line)) lines.set(line, block.path.loc.start.column);

		let indent = lines.get(line);
		let addTo = current;

		if (addTo != null) {
			if (indent == current.indent) {
				addTo = current.parent;
			} else if (indent < current.indent) {
				let parent = current.parent;
				while (parent != null && indent <= parent.indent) {
					parent = parent.parent;
				}
				addTo = parent;
			}
		}

		let positionedBlock = {
			block: block,
			children: [],
			indent: indent,
			line: line,
			parent: addTo
		};

		current = positionedBlock;

		if (addTo != null)
		{
			if (addTo.children == null)
				addTo.children = [positionedBlock];
			else
				addTo.children.push(positionedBlock);
		}
		else
			list.push(positionedBlock);
	}
	return list;
}

function createExpr(positionedBlocks, functionPrefix) {
	var exprList = createExprList(positionedBlocks, functionPrefix);
	return exprList.length == 0 ? undefined : exprList.length == 1 ? exprList[0] : t.arrayExpression(exprList);
}

function generateIfChain(conditions) {
	// get the next condition
	var condition = conditions.shift();

	// check for no more conditions, or final else
	if (condition == null) return null;
	if (condition.cond == null) return condition.child;

	// recurse deeper to generate the next if
	var nextIf = generateIfChain(conditions);
	if (nextIf == null) 
		return t.conditionalExpression(condition.cond, condition.child, t.unaryExpression('void', t.numericLiteral(0)));
	else
		return t.conditionalExpression(condition.cond, condition.child, nextIf);
}

function createExprList(list, functionPrefix) {
	var exprList = [];

	for (let i = 0; i < list.length; i++) {
		let item = list[i];
		switch (item.block.type) {
			case "TildeElement":
				exprList.push(item.block.path.argument);
				break;

			case "ElementBlock":
			case "CustomElement":
				let tag = item.block.type == "ElementBlock" ? t.stringLiteral(item.block.selector.tag) : t.identifier(item.block.selector.tag);
				let attrs = createAttrsExpr(item);
				let childs = createExprList(item.children, functionPrefix);
				if (item.block.content) childs.push(item.block.content);
				let args = [];

				//if (tag) args.push(tag);
				args.push(tag);
				args.push(attrs);
				//let isObj = t.isObjectExpression(attrs);
				//if ((isObj && attrs.properties.length > 0) || !isObj) args.push(attrs);
				if (childs.length > 0) args.push(t.arrayExpression(childs));
				//for (let child of childs) {
					//args.push(child);
				//}

				//let expr = t.callExpression(t.memberExpression(t.identifier("React"), t.identifier('createElement')), args);
				let expr = t.callExpression(functionPrefix, args);
				exprList.push(expr);
				break;

			case "ExprBlock":
				exprList.push(item.block.path);
				break;

			case "Map":
				exprList.push(MapTemplate({ LIST: item.block.path.params[0], ITEM: item.block.path.body, EXPR: createExprList(item.children, functionPrefix) }));

				break;

			case "NullMap":
				const ast = 
					item.block.path.left.type == "CallExpression" ?
					NullMapCallExpressionTemplate({ CALL: item.block.path.left, ITEM: item.block.path.right, EXPR: createExprList(item.children, functionPrefix) })
				:
					NullMapTemplate({ LIST: item.block.path.left, ITEM: item.block.path.right, EXPR: createExprList(item.children, functionPrefix) });
				exprList.push(ast.expression);
				break;

			case "If":
				let conditions = [];
				conditions.push({ cond: item.block.condition, child: createExpr(item.children, functionPrefix) });

				if (list.length > i+1) {
					for (let y = i+1; y < list.length; y++) {
						let next = list[y];
						if (next.block.type == "Else") {
							if (next.indent == item.indent) {
								conditions.push({ cond: null, child: createExpr(next.children, functionPrefix) });
								break;
							}
						} else if (next.block.type == "ElseIf") {
							if (next.indent == item.indent)
								conditions.push({ cond: item.block.condition, child: createExpr(next.children, functionPrefix) });
							else
								break;
						} else if (next.indent == item.indent) break;
					}
				}

				exprList.push(generateIfChain(conditions));

				break;
			case "Else":
				break;
			case "ElseIf":
				break;

			default:
				throw "parse error: " + item.block.type;
		}

	}

	return exprList;
}

const NullMapCallExpressionTemplate = template(`
(() => {
	let t = CALL;
	return t ? t.map((ITEM) => EXPR) : [];
})()
`);

const NullMapTemplate = template(`LIST ? LIST.map(ITEM => EXPR) : []`);

const MapTemplate = template(`LIST.map(ITEM => EXPR)`);


function createAttrsExpr(data) {
	var obj = data.block.attributes || t.objectExpression([]);

	var id = data.block.selector.id;
	if (id)
		addToObjFields(obj, 'id', t.stringLiteral(id));

	var className = data.block.selector.classes ? data.block.selector.classes.join(' ') : undefined;
	if (className)
		addToObjFields(obj, 'className', t.stringLiteral(className));

	for (let attr of data.block.inlineAttributes) {
		addToObjFields(obj, attr.attr, attr.value);
	}

	return obj;
}

function addToObjFields(obj, key, expr) {
	var exists = false;
	obj.properties.map(function(prop) {
		if (prop.key.name == key) {
			exists = true;
			if (key == 'className') {
				if (prop.value.type == "StringLiteral" && expr.type == "StringLiteral") { 
					prop.value = t.stringLiteral(expr.value + ' ' + prop.value.value);
				} else {
					prop.value = t.binaryExpression('+', t.binaryExpression('+', expr, t.stringLiteral(' ')), prop.value);
				}
			} else {
				prop.value = expr;
			}
		}
	});
	if (!exists) {
		obj.properties.push(t.objectProperty(t.identifier(key), expr));
	}
}

function parseEndBlock(e, element) {
	var clean = generate(e, {
		retainFunctionParens: true,
		comments: false,
	});
	var cleanAST = babylon.parse(clean.code);
	traverse(cleanAST, removeAttr);
	clean = generate(cleanAST);

	var code = clean.code.replace(/\s/g, '').slice(0, -1);
	element.selector = parseSelector(code);
	if (element.selector.tag[0] === element.selector.tag[0].toUpperCase()) element.type = "CustomElement";
}

const removeAttr = {
	CallExpression(path) {
		path.replaceWith(path.node.callee);
	},
};

function parseSelector(selector) {
	selector = selector.replace(/\./g, ',.').replace(/\+/g, ',+');
	var parts = selector.split(',');
	var rslt = {
		tag: '',
		classes: [],
		id: ''
	};

	for (let part of parts) {
		let value = part.substr(1);
		if (part[0] == ".") {
			rslt.classes.push(value);
		} else if (part[0] == "+") {
			rslt.id = value;
		} else {
			rslt.tag = part;
		}
	}

	return rslt;
}	

function extractAttributes(attrs) {
	var attr = t.objectExpression([]);
	var mergeThese = [];

	for (let entry of attrs) {
		if (entry.type == "AssignmentExpression") {
			attr.properties.push(t.objectProperty(entry.left, entry.right));
		} else {
			mergeThese.push(entry);
		}
	}

	if (attr.properties.length == 0 && mergeThese.length == 1) return mergeThese[0];
	if (mergeThese.length == 0) return attr;

	var expr = t.callExpression(t.memberExpression(t.identifier('Object'), t.identifier('assign')), []);
	expr.arguments.push(attr);
	for(let m of mergeThese) expr.arguments.push(m);
	return expr;
}
