var contacts = [
	{key: 1, name: "This Contact", email: "has-an-email"},
	{key: 2, name: "No email"}
]

const view = $>
		(div)
			(h1 > 'Contacts')
			(ul)
				(contacts.filter(contact => contact.email) >> contact)
					(li(key=contact.key))
						(h2 > contact.name)
						(a(href='mailto:' + contact.email) > contact.email)

ReactDOM.render(view, document.getElementById('react-app'))
