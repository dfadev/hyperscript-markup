React.createElement("div", {}, [(() => {
	let t = itemsFromAFunctionCall();
	return t ? t.map((item) => React.createElement("div", {}, [item.text])) : [];
})()]);
