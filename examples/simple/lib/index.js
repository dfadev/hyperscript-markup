"use strict";

var contacts = [{ key: 1, name: "This Contact", email: "has-an-email" }, { key: 2, name: "No email" }];

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

ReactDOM.render(view, document.getElementById('react-app'));