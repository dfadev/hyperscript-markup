# hyperscript-markup

This is a Babel plugin that transpiles markup into hyperscript.  Compatible with any hyperscript library that accepts hyperscript in the form of `hyperscriptFunction(tag, attributes, [children])`.  Works with [React](https://facebook.github.io/react/), [Mithril](https://mithril.js.org/), and [Hyperapp](https://github.com/hyperapp/hyperapp).



## Template Syntax

Views are declared by the magic sequence `$>`.  This will transpile the template that follows it into hyperscript calls.  

You can specify which hyperscript function to call like this: 

* `$>` -- Transpile to `React.createElement()`.
* `$m>` -- Transpile to `m()`.
* `$h>` -- Transpile to `h()`.
* `$yourFunc>` -- Transpile to `yourFunc()`.

For example, this template:
````javascript
const view = $>
		(div)
			(h1 > 'Contacts')
			(ul)
				(contacts.filter(contact => contact.email) >> contact)
					(li(key=contact.key))
						(h2 > contact.name)
						(a(href='mailto:' + contact.email) > contact.email)
````
Will transpile to this code:
````javascript
var view = React.createElement("div", {}, [React.createElement("h1", {}, ['Contacts']), React.createElement("ul", {}, [function () {
	var t = contacts.filter(function (contact) {
		return contact.email;
	});
	return t ? t.map(function (contact) {
		return React.createElement("li", {
			key: contact.key
		}, [React.createElement("h2", {}, [contact.name]), React.createElement("a", {
			href: 'mailto:' + contact.email
		}, [contact.email])]);
	}) : [];
}()])]);
````

#### Elements

Any html element can be expressed in parentheses:
```javascript
(img)
```

CSS classes can be set using the `.` operator:
```javascript
(img.my-class-name.my-other-class-name)
```

An element id can be set with the `+` operator (as # wouldn't be valid haxe syntax):
```javascript
(img+my-id)
```

Attributes can be used inside the selector:
```javascript
(img(src="img.jpg"))
```

Attributes can also be expressed separately:
```javascript
(img(src="img.jpg", alt=""))
(img(src="img.jpg", aFunctionCallReturningAttributes()))
```

A component needs to have it's first letter capitialized:
```javascript
(div)
    (MyComponent(param=1))
    (MyOtherComponent(param=2))
```

#### Children

A shortcut for defining one child:
```javascript
(h1 > 'My title')
```

More than one child can be nested by using indentation:
```javascript
    (nav)
    	(ul.links)
    		(li)
    			(a(href="http://haxe.org") > 'Haxe')
    		(li)
    			(a(href="http://github.com") > 'Github')
```

#### Inline expressions
Strings and template strings are supported.

```javascript
(h1)
	('A string for example')
(button)
	(`${this.buttonLabel}`)
```
Prefix an expression or identifier with the tilde operator `~` to embed an expression without a call to the hyperscript functor.
```javascript
(div)
	(~expression)
```
Would translate to:
```javascript
React.createElement('div', {}, expression)
```

#### Conditionals

`$if`, `$elseif`, and `$else` can be used inside templates:

```javascript
($if (headerSize == 1))
	(h1 > 'Big')
($elseif (headerSize == 2))
	(h2 > 'Not that big')
($else)
	(p > 'Paragraph')
```

#### Map

The following syntax can be used for any object (in this case `links`) with a map method:

```javascript
(links => link)
	(a (href=link.url, target='_blank') > link.title)
```

#### Map with null check

Using the `>>` operator adds a null check prior to map execution.

```javascript
(links >> link)
	(a (href=link.url, target='_blank') > link.title)
```

Translates to:

```javascript
if (links != null)
	links.map(function(link) React.createElement('a', { href: link.url, target: '_blank' }, [ link.title ]);
else
	[];
```

## Sample

An example can be found at [`examples/simple`](https://github.com/dfadev/hyperscript-markup/tree/master/examples/simple).

To build it:
```bash
cd examples/simple
npm install
npm run build
cd htdocs
see index.html
```

