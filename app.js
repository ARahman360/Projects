const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const filterButtons = document.querySelectorAll('.filter-button');
const menuCards = document.querySelectorAll('.menu-card');
const menuEmpty = document.querySelector('.menu-empty');
const menuOverview = document.querySelector('[data-menu-overview]');
const fullMenuParts = [document.querySelector('.menu-toolbar'), ...document.querySelectorAll('.menu-grid'), menuEmpty];
const fullMenuTrigger = document.querySelector('[data-full-menu-trigger]');

const cartItems = document.querySelector('.cart-items');
const cartCount = document.querySelector('[data-cart-count]');
const cartSubtotal = document.querySelector('[data-cart-subtotal]');
const cartDelivery = document.querySelector('[data-cart-delivery]');
const cartTotal = document.querySelector('[data-cart-total]');
const clearCartButton = document.querySelector('.clear-cart');
const orderForm = document.querySelector('#order-form');
const orderStatus = document.querySelector('.order-status');
const addressField = document.querySelector('#order-address');
const deliveryOnly = document.querySelector('.delivery-only');
const checkoutButton = document.querySelector('.checkout-button');
const basketTrigger = document.querySelector('[data-basket-trigger]');
const headerCartCount = document.querySelector('[data-header-cart-count]');
const headerCartTotal = document.querySelector('[data-header-cart-total]');
const headerCartBadge = document.querySelector('[data-header-cart-badge]');
const paymentButtons = document.querySelectorAll('.payment-method');
const paymentPanels = document.querySelectorAll('.payment-panel');
let paymentMethod = 'mpesa';
const deliveryTracker = document.querySelector('#delivery-tracker');
const currentStatus = document.querySelector('[data-current-status]');
const orderEta = document.querySelector('[data-order-eta]');
const orderReference = document.querySelector('[data-order-reference]');
const trackerUpdated = document.querySelector('.tracker-updated');
const trackerSteps = document.querySelectorAll('.tracker-steps li');
const trackerStepTitles = document.querySelectorAll('[data-step-title]');
const trackerStepDetails = document.querySelectorAll('[data-step-detail]');
const trackerMode = document.querySelector('[data-order-mode]');
const trackerTotal = document.querySelector('[data-order-total]');
const trackerProgress = document.querySelector('[data-tracker-progress]');
const accountTrigger = document.querySelector('[data-account-trigger]');
const accountLabel = document.querySelector('[data-account-label]');
const accountModal = document.querySelector('[data-account-modal]');
const accountForm = document.querySelector('#account-form');
const accountInput = document.querySelector('#account-identifier');
const accountInputLabel = document.querySelector('[data-account-input-label]');
const accountStatus = document.querySelector('.account-status');
const accountHeading = document.querySelector('[data-account-heading]');
const accountKicker = document.querySelector('[data-account-kicker]');
const accountCopy = document.querySelector('[data-account-copy]');
const guestAction = document.querySelector('[data-guest-action]');
const accountMethods = document.querySelectorAll('[data-auth-method]');
const accountPassword = document.querySelector('#account-password');
const passwordToggle = document.querySelector('[data-password-toggle]');
const forgotPassword = document.querySelector('[data-forgot-password]');
const accountProfile = document.querySelector('[data-account-profile]');
const profileName = document.querySelector('[data-profile-name]');
const profileDetail = document.querySelector('[data-profile-detail]');
const profileAvatar = document.querySelector('[data-profile-avatar]');
const signOutButton = document.querySelector('[data-sign-out]');
const firstNameInput = document.querySelector('#account-first-name');
const lastNameInput = document.querySelector('#account-last-name');
const profileFullName = document.querySelector('[data-profile-full-name]');
const profileAccount = document.querySelector('[data-profile-account]');
const profileOrders = document.querySelector('[data-profile-orders]');
const profilePhone = document.querySelector('[data-profile-phone]');
const profileAddress = document.querySelector('[data-profile-address]');
const profileEditButton = document.querySelector('[data-profile-edit]');
const profileEditForm = document.querySelector('[data-profile-edit-form]');
const headerLocation = document.querySelector('[data-header-location]');
const profileMenuTrigger = document.querySelector('[data-profile-menu-trigger]');
const moreTrigger = document.querySelector('[data-more-trigger]');
const moreMenu = document.querySelector('[data-more-menu]');
const goBackButton = document.querySelector('[data-go-back]');
const pageNav = document.querySelector('.page-nav');
const savedCheckoutNote = document.querySelector('[data-saved-checkout-note]');
const checkoutIdentityFields = [document.querySelector('#order-name'), document.querySelector('#order-phone'), document.querySelector('#order-address')];

let orderMethod = 'delivery';
let cart = JSON.parse(localStorage.getItem('halaliCart') || '[]');
let activeOrder = JSON.parse(localStorage.getItem('halaliOrder') || 'null');
let authMethod = 'email';
let trackerTimer;

const formatPrice = (amount) => `KSh ${amount.toLocaleString('en-KE')}`;
const setFeedback = (element, message, type = 'info') => {
	element.textContent = message;
	element.classList.remove('is-error', 'is-success', 'is-info');
	element.classList.add(`is-${type}`);
};

const revealElements = document.querySelectorAll('.section, .hero-copy, .hero-image, .marquee, .site-footer');
revealElements.forEach((element) => element.classList.add('reveal-ready'));
if ('IntersectionObserver' in window) {
	const revealObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			entry.target.classList.add('is-visible');
			observer.unobserve(entry.target);
		});
	}, { threshold: 0.12 });
	revealElements.forEach((element) => revealObserver.observe(element));
} else {
	revealElements.forEach((element) => element.classList.add('is-visible'));
}

let currentAccount = JSON.parse(localStorage.getItem('halaliAccount') || 'null');
const updateAccountView = (account) => {
	const signedIn = Boolean(account);
	accountHeading.innerHTML = signedIn ? 'Your<br><em>profile.</em>' : 'Welcome<br><em>back.</em>';
	accountKicker.textContent = signedIn ? 'Profile' : 'Your Halali table';
	accountCopy.textContent = signedIn ? 'Keep your details ready for faster checkout and a smoother visit.' : 'Save your details, follow orders, and make your next meal one tap away.';
	accountLabel.textContent = signedIn ? account.label : 'Sign in';
	accountProfile.hidden = !signedIn;
	accountForm.hidden = signedIn || authMethod === 'guest';
	guestAction.hidden = signedIn || authMethod !== 'guest';
	if (signedIn) {
		profileName.textContent = account.label;
		profileDetail.textContent = account.method === 'guest' ? 'Guest checkout' : `Signed in with ${account.method}`;
		profileAvatar.textContent = account.label.slice(0, 1).toUpperCase();
		profileFullName.textContent = account.name || account.label;
		profilePhone.textContent = account.phone || 'Not added';
		profileAddress.textContent = account.address || 'Not added';
		headerLocation.textContent = account.address ? account.address.split(',')[0] : 'Nairobi';
		profileAccount.textContent = account.method === 'guest' ? 'Guest checkout' : `${account.method} sign in`;
		profileOrders.textContent = `${localStorage.getItem('halaliOrder') ? 1 : 0} order${localStorage.getItem('halaliOrder') ? '' : 's'}`;
	}
	const useSavedDetails = signedIn && account.method !== 'guest';
	if (useSavedDetails) {
		checkoutIdentityFields[0].value = account.name || '';
		checkoutIdentityFields[1].value = account.phone || '';
		checkoutIdentityFields[2].value = account.address || '';
		checkoutIdentityFields.forEach((field) => { field.closest('.form-row').hidden = true; field.required = false; });
		savedCheckoutNote.hidden = false;
		savedCheckoutNote.textContent = `Using your saved profile details${account.address ? ` · ${account.address}` : ''}.`;
	} else {
		checkoutIdentityFields.forEach((field) => { field.closest('.form-row').hidden = false; field.required = field.id !== 'order-address' || orderMethod === 'delivery'; });
		savedCheckoutNote.hidden = true;
	}
	if (!signedIn) headerLocation.textContent = 'Nairobi';
};
const applySavedCheckoutDetails = () => {
	const account = currentAccount;
	const useSavedDetails = account && account.method !== 'guest';
	if (!useSavedDetails) return;
	checkoutIdentityFields[0].value = account.name || '';
	checkoutIdentityFields[1].value = account.phone || '';
	checkoutIdentityFields[2].value = account.address || '';
	checkoutIdentityFields.forEach((field) => { field.closest('.form-row').hidden = true; field.required = false; });
	savedCheckoutNote.hidden = false;
	savedCheckoutNote.textContent = `Using your saved profile details${account.address ? ` · ${account.address}` : ''}.`;
};
updateAccountView(currentAccount);

const setAuthMethod = (method) => {
	authMethod = method;
	accountMethods.forEach((button) => button.classList.toggle('active', button.dataset.authMethod === method));
	const isGuest = method === 'guest';
	if (!currentAccount) {
		accountForm.hidden = isGuest;
		guestAction.hidden = !isGuest;
	}
	if (method === 'phone') {
		accountInputLabel.textContent = 'Phone number';
		accountInput.type = 'tel';
		accountInput.placeholder = '+254 700 000 000';
		accountInput.autocomplete = 'tel';
	} else if (method === 'email') {
		accountInputLabel.textContent = 'Email address';
		accountInput.type = 'email';
		accountInput.placeholder = 'you@example.com';
		accountInput.autocomplete = 'email';
	}
};

const closeAccount = () => {
	accountModal.hidden = true;
	accountStatus.textContent = '';
};
const showBack = () => { pageNav.hidden = false; };
const hideBack = () => { pageNav.hidden = true; };

accountTrigger.addEventListener('click', () => { accountModal.hidden = false; setAuthMethod('email'); (currentAccount ? signOutButton : firstNameInput).focus(); });
document.querySelectorAll('[data-account-close]').forEach((button) => button.addEventListener('click', closeAccount));
accountMethods.forEach((button) => button.addEventListener('click', () => setAuthMethod(button.dataset.authMethod)));
accountForm.addEventListener('submit', (event) => {
	event.preventDefault();
	const identifier = new FormData(accountForm).get('identifier');
	const firstName = String(new FormData(accountForm).get('firstName') || '').trim();
	const lastName = String(new FormData(accountForm).get('lastName') || '').trim();
	const phone = String(new FormData(accountForm).get('phone') || '').trim();
	const password = String(new FormData(accountForm).get('password') || '');
	if (!firstName || !lastName) {
		setFeedback(accountStatus, 'Please enter your first and last name.', 'error');
		return;
	}
	if (phone.replace(/\D/g, '').length < 9) {
		setFeedback(accountStatus, 'Enter a valid phone number.', 'error');
		return;
	}
	if (!identifier || (authMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) || (authMethod === 'phone' && identifier.replace(/\D/g, '').length < 9)) {
		setFeedback(accountStatus, authMethod === 'email' ? 'Enter a valid email address.' : 'Enter a valid phone number.', 'error');
		return;
	}
	if (password.length < 8) {
		setFeedback(accountStatus, 'Use a password with at least 8 characters.', 'error');
		return;
	}
	const label = firstName;
	const account = { method: authMethod, identifier, phone, address: '', name: `${firstName} ${lastName}`, label, lastName, lastLogin: Date.now() };
	localStorage.setItem('halaliAccount', JSON.stringify(account));
	currentAccount = account;
	updateAccountView(account);
	setFeedback(accountStatus, 'You are signed in on this device.', 'success');
	window.setTimeout(closeAccount, 700);
});
guestAction.addEventListener('click', () => {
	const guestAccount = { method: 'guest', label: 'Guest' };
	localStorage.setItem('halaliAccount', JSON.stringify(guestAccount));
	currentAccount = guestAccount;
	updateAccountView(guestAccount);
	closeAccount();
});
passwordToggle.addEventListener('click', () => {
	const showing = accountPassword.type === 'text';
	accountPassword.type = showing ? 'password' : 'text';
	passwordToggle.textContent = showing ? 'Show' : 'Hide';
	passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});
forgotPassword.addEventListener('click', () => {
	setFeedback(accountStatus, 'Reset instructions are ready for your account email.', 'info');
});
signOutButton.addEventListener('click', () => {
	localStorage.removeItem('halaliAccount');
	currentAccount = null;
	updateAccountView(null);
	setAuthMethod('email');
	setFeedback(accountStatus, 'You have been signed out.', 'success');
});
profileEditButton.addEventListener('click', () => {
	profileEditForm.hidden = false;
	profileEditButton.hidden = true;
	profileEditForm.elements.firstName.value = currentAccount?.name?.split(' ')[0] || '';
	profileEditForm.elements.lastName.value = currentAccount?.lastName || '';
	profileEditForm.elements.phone.value = currentAccount?.phone || '';
	profileEditForm.elements.address.value = currentAccount?.address || '';
});
profileEditForm.addEventListener('submit', (event) => {
	event.preventDefault();
	const details = Object.fromEntries(new FormData(profileEditForm).entries());
	currentAccount = { ...currentAccount, ...details, name: `${details.firstName} ${details.lastName}`, label: details.firstName };
	localStorage.setItem('halaliAccount', JSON.stringify(currentAccount));
	updateAccountView(currentAccount);
	profileEditForm.hidden = true;
	profileEditButton.hidden = false;
});

moreTrigger.addEventListener('click', () => {
	const isOpen = moreMenu.hidden;
	moreMenu.hidden = !isOpen;
	moreTrigger.setAttribute('aria-expanded', String(isOpen));
});
document.addEventListener('click', (event) => {
	if (moreMenu.hidden || moreMenu.contains(event.target) || moreTrigger.contains(event.target)) return;
	moreMenu.hidden = true;
	moreTrigger.setAttribute('aria-expanded', 'false');
});
document.addEventListener('keydown', (event) => {
	if (event.key !== 'Escape') return;
	moreMenu.hidden = true;
	moreTrigger.setAttribute('aria-expanded', 'false');
});
moreMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
	moreMenu.hidden = true;
	moreTrigger.setAttribute('aria-expanded', 'false');
}));
goBackButton.addEventListener('click', () => {
	setMenuView(false);
	document.querySelector('#top').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
setAuthMethod('email');
profileMenuTrigger.addEventListener('click', () => {
	moreMenu.hidden = true;
	moreTrigger.setAttribute('aria-expanded', 'false');
	accountModal.hidden = false;
	if (currentAccount) updateAccountView(currentAccount);
	else setAuthMethod('email');
	(currentAccount ? profileEditButton : firstNameInput).focus();
});

const deliveryStages = [
	{ label: 'Order received', eta: 'Estimated arrival in 45–60 min' },
	{ label: 'Preparing your order', eta: 'The kitchen is cooking now · about 35 min left' },
	{ label: 'On the way', eta: 'Your rider is heading over · about 15 min left' },
	{ label: 'Arriving soon', eta: 'Your order should arrive in the next few minutes' },
];
const pickupStages = [
	{ label: 'Order received', eta: 'Estimated pickup in 20–30 min' },
	{ label: 'Preparing your order', eta: 'The kitchen is cooking now · about 15 min left' },
	{ label: 'Ready for pickup', eta: 'Your order is ready at the Halali counter' },
	{ label: 'Collected', eta: 'Enjoy your meal · thanks for dining with us' },
];
const getStatusStages = (method) => method === 'pickup' ? pickupStages : deliveryStages;

const renderTracker = () => {
	if (!activeOrder || activeOrder.method !== orderMethod) {
		deliveryTracker.hidden = true;
		return;
	}
	const statusStages = getStatusStages(activeOrder.method);
	const stage = Math.min(activeOrder.statusIndex || 0, statusStages.length - 1);
	const status = statusStages[stage];
	deliveryTracker.hidden = false;
	orderReference.textContent = activeOrder.reference;
	trackerMode.textContent = activeOrder.method === 'pickup' ? 'Pickup' : 'Delivery';
	trackerTotal.textContent = formatPrice(activeOrder.total);
	trackerProgress.style.width = `${Math.round((stage / (statusStages.length - 1)) * 100)}%`;
	currentStatus.textContent = status.label;
	orderEta.textContent = status.eta;
	trackerUpdated.textContent = `Updated ${new Date(activeOrder.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
	const stepContent = activeOrder.method === 'pickup'
		? [['Received', 'Order confirmed'], ['Preparing', 'Our kitchen is on it'], ['Ready', 'Come to the Halali counter'], ['Collected', 'Order complete']]
		: [['Received', 'Order confirmed'], ['Preparing', 'Our kitchen is on it'], ['On the way', 'Your rider is heading over'], ['Arriving', 'Almost at your door']];
	trackerStepTitles.forEach((step, index) => { step.textContent = stepContent[index][0]; });
	trackerStepDetails.forEach((step, index) => { step.textContent = stepContent[index][1]; });
	trackerSteps.forEach((step, index) => {
		step.classList.toggle('is-complete', index < stage);
		step.classList.toggle('is-current', index === stage);
	});
};

const startTracker = () => {
	clearInterval(trackerTimer);
	if (!activeOrder || activeOrder.method !== orderMethod || activeOrder.statusIndex >= getStatusStages(activeOrder.method).length - 1) return;
	trackerTimer = setInterval(() => {
		activeOrder.statusIndex = Math.min((activeOrder.statusIndex || 0) + 1, getStatusStages(activeOrder.method).length - 1);
		activeOrder.updatedAt = Date.now();
		localStorage.setItem('halaliOrder', JSON.stringify(activeOrder));
		renderTracker();
		if (activeOrder.statusIndex >= getStatusStages(activeOrder.method).length - 1) clearInterval(trackerTimer);
	}, 12000);
};

filterButtons.forEach((button) => {
	button.addEventListener('click', () => {
		const filter = button.dataset.filter;
		let visibleCount = 0;

		filterButtons.forEach((item) => item.classList.toggle('active', item === button));
		menuCards.forEach((card) => {
			const isVisible = filter === 'all' || card.dataset.category === filter;
			card.classList.toggle('is-hidden', !isVisible);
			if (isVisible) visibleCount += 1;
		});
		menuEmpty.hidden = visibleCount > 0;
	});
});

menuToggle.addEventListener('click', () => {
	const isOpen = navLinks.classList.toggle('open');
	menuToggle.setAttribute('aria-expanded', isOpen);
});

navLinks.querySelectorAll('a').forEach((link) => {
	link.addEventListener('click', () => {
		navLinks.classList.remove('open');
		menuToggle.setAttribute('aria-expanded', 'false');
	});
});

menuCards.forEach((card) => {
	const name = card.querySelector('strong').textContent;
	const price = Number(card.querySelector('b').textContent.replace(/[^0-9]/g, ''));
	const button = document.createElement('button');
	button.className = 'add-to-cart';
	button.type = 'button';
	button.dataset.name = name;
	button.dataset.price = price;
	button.textContent = 'Add to order +';
	button.setAttribute('aria-label', `Add ${name} to order`);
	card.querySelector('.dish-meta').append(button);
});

const overviewCategories = [
	['mains', 'Mains', 'From the fire, the garden, and the coast.'],
	['drinks', 'Drinks', 'Something bright, cold, or warmly spiced.'],
	['sweet', 'Sweets', 'A little finish for the table.'],
	['small-plates', 'Small plates', 'Start here and share generously.'],
	['brunch', 'Brunch', 'Slow mornings, served all day.'],
];

overviewCategories.forEach(([category, label, description]) => {
	const categoryCards = [...menuCards].filter((card) => card.dataset.category === category);
	const rail = document.createElement('section');
	rail.className = 'menu-rail';
	rail.dataset.category = category;
	rail.innerHTML = `<div class="menu-rail-heading"><div><span class="kicker">${label}</span><p>${description}</p></div><div class="menu-rail-actions"><button type="button" class="rail-arrow" data-rail-direction="left" aria-label="Show previous ${label.toLowerCase()}">←</button><button type="button" class="rail-arrow" data-rail-direction="right" aria-label="Show more ${label.toLowerCase()}">→</button></div></div><div class="menu-rail-track"></div>`;
	const track = rail.querySelector('.menu-rail-track');
	categoryCards.forEach((card) => track.append(card.cloneNode(true)));
	menuOverview.append(rail);
});

const setMenuView = (showFullMenu) => {
	menuOverview.hidden = showFullMenu;
	if (showFullMenu) showBack();
	if (!showFullMenu) hideBack();
	fullMenuParts.forEach((part) => {
		if (part) part.hidden = !showFullMenu;
	});
};
setMenuView(false);

menuOverview.addEventListener('click', (event) => {
	const arrow = event.target.closest('.rail-arrow');
	if (!arrow) return;
	const track = arrow.closest('.menu-rail').querySelector('.menu-rail-track');
	track.scrollBy({ left: arrow.dataset.railDirection === 'right' ? track.clientWidth * 0.82 : -track.clientWidth * 0.82, behavior: 'smooth' });
});

fullMenuTrigger.addEventListener('click', (event) => {
	event.preventDefault();
	setMenuView(true);
	document.querySelector('#menu').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

const saveCart = () => localStorage.setItem('halaliCart', JSON.stringify(cart));

const refreshAddButtons = () => {
	document.querySelectorAll('.add-to-cart').forEach((button) => {
		const item = cart.find((entry) => entry.name === button.dataset.name);
		const quantity = item ? item.quantity : 0;
		button.textContent = quantity ? `Add to order +${quantity}` : 'Add to order +';
		button.classList.toggle('has-quantity', quantity > 0);
		button.disabled = false;
	});
};

const renderCart = () => {
	const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
	const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
	const deliveryFee = orderMethod === 'delivery' && itemCount > 0 ? 250 : 0;

	cartCount.textContent = itemCount;
	cartSubtotal.textContent = formatPrice(subtotal);
	cartDelivery.textContent = deliveryFee ? formatPrice(deliveryFee) : 'No fee';
	cartTotal.textContent = formatPrice(subtotal + deliveryFee);
	clearCartButton.hidden = cart.length === 0;
	checkoutButton.disabled = cart.length === 0;
	checkoutButton.textContent = cart.length === 0 ? 'Checkout basket' : `Checkout basket · ${formatPrice(subtotal + deliveryFee)}`;
	headerCartCount.textContent = itemCount;
	headerCartTotal.textContent = formatPrice(subtotal + deliveryFee);
	headerCartBadge.textContent = itemCount;
	basketTrigger.setAttribute('aria-label', `Open basket, ${itemCount} item${itemCount === 1 ? '' : 's'}`);
	basketTrigger.classList.toggle('has-items', itemCount > 0);
	refreshAddButtons();
	if (cart.length === 0) {
		cartItems.innerHTML = '<div class="cart-empty"><span class="empty-basket-icon">＋</span><strong>Your basket is empty</strong><p>Add something delicious from the menu to get started.</p><button class="empty-basket-action" type="button">Add items to your basket <span>↗</span></button></div>';
		return;
	}

	cartItems.innerHTML = cart.map((item, index) => `<div class="cart-item"><div><strong>${item.name}</strong><span>${formatPrice(item.price)}</span></div><div class="quantity-control"><button type="button" data-cart-action="decrease" data-cart-index="${index}" aria-label="Remove one ${item.name}">−</button><span>${item.quantity}</span><button type="button" data-cart-action="increase" data-cart-index="${index}" aria-label="Add one ${item.name}">+</button></div></div>`).join('');
};

const addItemFromMenu = (event) => {
	const button = event.target.closest('.add-to-cart');
	if (!button) return;
	const existing = cart.find((item) => item.name === button.dataset.name);
	if (existing) existing.quantity += 1;
	else cart.push({ name: button.dataset.name, price: Number(button.dataset.price), quantity: 1 });
	saveCart();
	renderCart();
};
document.querySelectorAll('.menu-grid').forEach((grid) => grid.addEventListener('click', addItemFromMenu));
menuOverview.addEventListener('click', addItemFromMenu);

cartItems.addEventListener('click', (event) => {
	if (event.target.closest('.empty-basket-action')) {
		document.querySelector('#menu').scrollIntoView({ behavior: 'smooth', block: 'start' });
		return;
	}
	const button = event.target.closest('[data-cart-action]');
	if (!button) return;
	const item = cart[Number(button.dataset.cartIndex)];
	if (button.dataset.cartAction === 'increase') item.quantity += 1;
	else item.quantity -= 1;
	cart = cart.filter((entry) => entry.quantity > 0);
	saveCart();
	renderCart();
});

clearCartButton.addEventListener('click', () => {
	cart = [];
	saveCart();
	renderCart();
});

document.querySelectorAll('.method-button').forEach((button) => {
	button.addEventListener('click', () => {
		orderMethod = button.dataset.method;
		document.querySelectorAll('.method-button').forEach((item) => item.classList.toggle('active', item === button));
		deliveryOnly.hidden = orderMethod === 'pickup';
		addressField.required = orderMethod === 'delivery';
		orderForm.hidden = true;
		checkoutButton.hidden = false;
		renderTracker();
		startTracker();
		renderCart();
	});
});

const setPaymentMethod = (method) => {
	paymentMethod = method;
	paymentButtons.forEach((button) => button.classList.toggle('active', button.dataset.payment === method));
	paymentPanels.forEach((panel) => {
		const isActive = panel.dataset.paymentPanel === method;
		panel.hidden = !isActive;
		panel.querySelectorAll('input').forEach((input) => { input.required = isActive && (method === 'mpesa' || method === 'airtel' || method === 'card'); });
	});
};

paymentButtons.forEach((button) => {
	button.addEventListener('click', () => setPaymentMethod(button.dataset.payment));
});

checkoutButton.addEventListener('click', () => {
	if (checkoutButton.disabled) return;
	orderForm.hidden = false;
	checkoutButton.hidden = true;
	applySavedCheckoutDetails();
	orderForm.querySelector('input').focus();
	showBack();
});

basketTrigger.addEventListener('click', () => {
	document.querySelector('#order').scrollIntoView({ behavior: 'smooth', block: 'start' });
	orderForm.hidden = true;
	checkoutButton.hidden = false;
	showBack();
});

orderForm.addEventListener('submit', (event) => {
	event.preventDefault();
	if (cart.length === 0) {
		setFeedback(orderStatus, 'Your basket is empty. Add a dish before checking out.', 'error');
		return;
	}
	const order = Object.fromEntries(new FormData(orderForm).entries());
	order.method = orderMethod;
	order.items = cart;
	order.total = cart.reduce((total, item) => total + item.price * item.quantity, 0) + (orderMethod === 'delivery' ? 250 : 0);
	order.paymentMethod = paymentMethod;
	if (paymentMethod === 'card') {
		const cardNumber = String(order.cardNumber || '').replace(/\s/g, '');
		order.payment = { type: 'card', last4: cardNumber.slice(-4) };
	} else if (paymentMethod === 'mpesa') {
		order.payment = { type: 'mpesa', phone: order.mpesaPhone };
	} else if (paymentMethod === 'airtel') {
		order.payment = { type: 'airtel', phone: order.airtelPhone };
	} else {
		order.payment = { type: 'cash' };
	}
	delete order.cardName;
	delete order.cardNumber;
	delete order.cardExpiry;
	delete order.cardCvv;
	delete order.mpesaPhone;
	delete order.airtelPhone;
	order.reference = `HAL-${Date.now().toString().slice(-6)}`;
	order.statusIndex = 0;
	order.updatedAt = Date.now();
	activeOrder = order;
	localStorage.setItem('halaliOrder', JSON.stringify(order));
	cart = [];
	saveCart();
	renderCart();
	setFeedback(orderStatus, `Order ${order.reference} is confirmed and being prepared.`, 'success');
	orderForm.classList.add('is-confirmed');
	checkoutButton.hidden = true;
	renderTracker();
	startTracker();
});

const bookingForm = document.querySelector('#booking-form');
const bookingDate = document.querySelector('#booking-date');
const formStatus = document.querySelector('.form-status');
const bookingConfirmation = document.querySelector('.booking-confirmation');
const currentYear = document.querySelector('[data-current-year]');
const newsletterForm = document.querySelector('#newsletter-form');
const newsletterStatus = document.querySelector('.newsletter-status');

const now = new Date();
const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];

bookingDate.min = localDate;
currentYear.textContent = now.getFullYear();

bookingForm.addEventListener('submit', (event) => {
	event.preventDefault();
	const booking = Object.fromEntries(new FormData(bookingForm).entries());
	localStorage.setItem('halaliBooking', JSON.stringify(booking));
	setFeedback(formStatus, `Table request received, ${booking.name}.`, 'success');
	bookingForm.classList.add('is-confirmed');
	bookingConfirmation.hidden = false;
	bookingForm.reset();
	bookingDate.min = localDate;
	bookingConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

newsletterForm.addEventListener('submit', (event) => {
	event.preventDefault();
	const email = new FormData(newsletterForm).get('email');
	localStorage.setItem('halaliNewsletter', email);
	setFeedback(newsletterStatus, 'You are on the list. See you at the table.', 'success');
	newsletterForm.reset();
});

renderCart();
refreshAddButtons();
renderTracker();
startTracker();