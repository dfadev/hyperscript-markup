"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (_ref) {
	var t = _ref.types;

	return {
		visitor: {
			BinaryExpression: function BinaryExpression(path) {

				if (path.node.operator != "<<") {
					return;
				}
				var functionPrefix = t.memberExpression(t.identifier("React"), t.identifier("createElement"));
				if (t.isIdentifier(path.node.left)) {
					var nm = path.node.left.name;
					if (nm[0] != "$" || nm[1] != "$") return;
					if (nm.length > 2) functionPrefix = t.identifier(nm.substring(2));
				} else if (t.isMemberExpression(path.node.left)) {
					var clean = (0, _babelGenerator2.default)(path.node.left, { comments: false });

					var _nm = clean.code;
					if (_nm[0] != "$" || _nm[1] != "$") return;
					if (_nm.length > 2) functionPrefix = babylon.parseExpression(_nm.substring(2));
				}

				path.replaceWith(createExpr(orderBlocks(parseCalls(path.node.right)), functionPrefix));
			}
		}
	};
};

var _babelTemplate = require("babel-template");

var _babelTemplate2 = _interopRequireDefault(_babelTemplate);

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

var _babelGenerator = require("babel-generator");

var _babelGenerator2 = _interopRequireDefault(_babelGenerator);

var _babylon = require("babylon");

var babylon = _interopRequireWildcard(_babylon);

var _babelTraverse = require("babel-traverse");

var _babelTraverse2 = _interopRequireDefault(_babelTraverse);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

;

function parseCalls(path) {
	switch (path.type) {
		case "CallExpression":
			if (path.callee.extra && path.callee.extra.parenthesized || path.callee.type == "CallExpression") {
				var b1 = parseCalls(path.callee);
				var b2 = chainElement(path.arguments[0]);
				return [b2].concat(b1);
			} else {
				var _b = chainElement(path);
				return [_b];
			}

		case "MemberExpression":
			if (path.object.extra && path.object.extra.parenthesized && path.property.type != "SequenceExpression") {
				var _b2 = parseCalls(path.object);
				var _b3 = chainElement(path.property);
				return [_b3].concat(_b2);
			} else {
				var _b4 = chainElement(path);
				return [_b4];
			}
			break;

		case "ArrayExpression":
			var expr = [];
			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = path.elements[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var element = _step.value;

					var block = {
						path: element,
						type: "ExprBlock"
					};
					expr.push(block);
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}

			expr.reverse();
			return expr;
			break;

		case "ArrowFunctionExpression":
		case "UnaryExpression":
		case "BinaryExpression":
		case "Identifier":
			var b = chainElement(path);
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
			id: ''
		},
		attributes: null,
		inlineAttributes: [],
		content: null
	};

	switch (path.type) {
		case "Identifier":
			// (div), (Component)
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

		case "BinaryExpression":
			// (div+id), (div-id), (div+id.css), (Component+id.css)
			if (path.operator == "+" || path.operator == "-") {
				var block = chainElement(path.right);
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

		case "MemberExpression":
			// id.css.css.css
			parseEndBlock(path, element);
			break;

		case "CallExpression":
			// (div(param=p))
			var foundDirective = false;
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
	var _iteratorNormalCompletion2 = true;
	var _didIteratorError2 = false;
	var _iteratorError2 = undefined;

	try {
		for (var _iterator2 = blocks[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
			var block = _step2.value;

			var line = block.path.loc.start.line;
			if (!lines.has(line)) lines.set(line, block.path.loc.start.column);

			var indent = lines.get(line);
			var addTo = current;

			if (addTo != null) {
				if (indent == current.indent) {
					addTo = current.parent;
				} else if (indent < current.indent) {
					var parent = current.parent;
					while (parent != null && indent <= parent.indent) {
						parent = parent.parent;
					}
					addTo = parent;
				}
			}

			var positionedBlock = {
				block: block,
				children: [],
				indent: indent,
				line: line,
				parent: addTo
			};

			current = positionedBlock;

			if (addTo != null) {
				if (addTo.children == null) addTo.children = [positionedBlock];else addTo.children.push(positionedBlock);
			} else list.push(positionedBlock);
		}
	} catch (err) {
		_didIteratorError2 = true;
		_iteratorError2 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion2 && _iterator2.return) {
				_iterator2.return();
			}
		} finally {
			if (_didIteratorError2) {
				throw _iteratorError2;
			}
		}
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
	if (nextIf == null) return t.conditionalExpression(condition.cond, condition.child, t.unaryExpression('void', t.numericLiteral(0)));else return t.conditionalExpression(condition.cond, condition.child, nextIf);
}

function createExprList(list, functionPrefix) {
	var exprList = [];

	for (var i = 0; i < list.length; i++) {
		var item = list[i];
		switch (item.block.type) {
			case "TildeElement":
				exprList.push(item.block.path.argument);
				break;

			case "ElementBlock":
			case "CustomElement":
				var tag = item.block.type == "ElementBlock" ? t.stringLiteral(item.block.selector.tag) : t.identifier(item.block.selector.tag);
				var attrs = createAttrsExpr(item);
				var childs = createExprList(item.children, functionPrefix);
				if (item.block.content) childs.push(item.block.content);
				var args = [];

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
				var expr = t.callExpression(functionPrefix, args);
				exprList.push(expr);
				break;

			case "ExprBlock":
				exprList.push(item.block.path);
				break;

			case "Map":
				exprList.push(MapTemplate({ LIST: item.block.path.params[0], ITEM: item.block.path.body, EXPR: createExprList(item.children, functionPrefix) }));

				break;

			case "NullMap":
				var ast = item.block.path.left.type == "CallExpression" ? NullMapCallExpressionTemplate({ CALL: item.block.path.left, ITEM: item.block.path.right, EXPR: createExprList(item.children, functionPrefix) }) : NullMapTemplate({ LIST: item.block.path.left, ITEM: item.block.path.right, EXPR: createExprList(item.children, functionPrefix) });
				exprList.push(ast.expression);
				break;

			case "If":
				var conditions = [];
				conditions.push({ cond: item.block.condition, child: createExpr(item.children, functionPrefix) });

				if (list.length > i + 1) {
					for (var y = i + 1; y < list.length; y++) {
						var next = list[y];
						if (next.block.type == "Else") {
							if (next.indent == item.indent) {
								conditions.push({ cond: null, child: createExpr(next.children, functionPrefix) });
								break;
							}
						} else if (next.block.type == "ElseIf") {
							if (next.indent == item.indent) conditions.push({ cond: item.block.condition, child: createExpr(next.children, functionPrefix) });else break;
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

var NullMapCallExpressionTemplate = (0, _babelTemplate2.default)("\n(() => {\n\tlet t = CALL;\n\treturn t ? t.map((ITEM) => EXPR) : [];\n})()\n");

var NullMapTemplate = (0, _babelTemplate2.default)("LIST ? LIST.map(ITEM => EXPR) : []");

var MapTemplate = (0, _babelTemplate2.default)("LIST.map(ITEM => EXPR)");

function createAttrsExpr(data) {
	var obj = data.block.attributes || t.objectExpression([]);

	var id = data.block.selector.id;
	if (id) addToObjFields(obj, 'id', t.stringLiteral(id));

	var className = data.block.selector.classes ? data.block.selector.classes.join(' ') : undefined;
	if (className) addToObjFields(obj, 'className', t.stringLiteral(className));

	var _iteratorNormalCompletion3 = true;
	var _didIteratorError3 = false;
	var _iteratorError3 = undefined;

	try {
		for (var _iterator3 = data.block.inlineAttributes[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
			var attr = _step3.value;

			addToObjFields(obj, attr.attr, attr.value);
		}
	} catch (err) {
		_didIteratorError3 = true;
		_iteratorError3 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion3 && _iterator3.return) {
				_iterator3.return();
			}
		} finally {
			if (_didIteratorError3) {
				throw _iteratorError3;
			}
		}
	}

	return obj;
}

function addToObjFields(obj, key, expr) {
	var exists = false;
	obj.properties.map(function (prop) {
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
	var clean = (0, _babelGenerator2.default)(e, {
		retainFunctionParens: true,
		comments: false
	});
	var cleanAST = babylon.parse(clean.code);
	(0, _babelTraverse2.default)(cleanAST, removeAttr);
	clean = (0, _babelGenerator2.default)(cleanAST);

	var code = clean.code.replace(/\s/g, '').slice(0, -1);
	element.selector = parseSelector(code);
	if (element.selector.tag[0] === element.selector.tag[0].toUpperCase()) element.type = "CustomElement";
}

var removeAttr = {
	CallExpression: function CallExpression(path) {
		path.replaceWith(path.node.callee);
	}
};

function parseSelector(selector) {
	selector = selector.replace(/\./g, ',.').replace(/\+/g, ',+');
	var parts = selector.split(',');
	var rslt = {
		tag: '',
		classes: [],
		id: ''
	};

	var _iteratorNormalCompletion4 = true;
	var _didIteratorError4 = false;
	var _iteratorError4 = undefined;

	try {
		for (var _iterator4 = parts[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
			var part = _step4.value;

			var value = part.substr(1);
			if (part[0] == ".") {
				rslt.classes.push(value);
			} else if (part[0] == "+") {
				rslt.id = value;
			} else {
				rslt.tag = part;
			}
		}
	} catch (err) {
		_didIteratorError4 = true;
		_iteratorError4 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion4 && _iterator4.return) {
				_iterator4.return();
			}
		} finally {
			if (_didIteratorError4) {
				throw _iteratorError4;
			}
		}
	}

	return rslt;
}

function extractAttributes(attrs) {
	var attr = t.objectExpression([]);
	var mergeThese = [];

	var _iteratorNormalCompletion5 = true;
	var _didIteratorError5 = false;
	var _iteratorError5 = undefined;

	try {
		for (var _iterator5 = attrs[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
			var entry = _step5.value;

			if (entry.type == "AssignmentExpression") {
				attr.properties.push(t.objectProperty(entry.left, entry.right));
			} else {
				mergeThese.push(entry);
			}
		}
	} catch (err) {
		_didIteratorError5 = true;
		_iteratorError5 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion5 && _iterator5.return) {
				_iterator5.return();
			}
		} finally {
			if (_didIteratorError5) {
				throw _iteratorError5;
			}
		}
	}

	if (attr.properties.length == 0 && mergeThese.length == 1) return mergeThese[0];
	if (mergeThese.length == 0) return attr;

	var expr = t.callExpression(t.memberExpression(t.identifier('Object'), t.identifier('assign')), []);
	expr.arguments.push(attr);
	var _iteratorNormalCompletion6 = true;
	var _didIteratorError6 = false;
	var _iteratorError6 = undefined;

	try {
		for (var _iterator6 = mergeThese[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
			var m = _step6.value;
			expr.arguments.push(m);
		}
	} catch (err) {
		_didIteratorError6 = true;
		_iteratorError6 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion6 && _iterator6.return) {
				_iterator6.return();
			}
		} finally {
			if (_didIteratorError6) {
				throw _iteratorError6;
			}
		}
	}

	return expr;
}