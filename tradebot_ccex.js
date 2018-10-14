//var graviex_access_key = 'fO6smltaJuJDV6b5jKBJfe2lAiZOczSYuYOnj4q7',
//	graviex_secret_key = 'UxUQTpxZryvgoHxkKgo1YjoiTzhRvVubxJZ12pFx',
//	graviex_base_url = 'https://graviex.net',
//	graviex_api_path = '/api/v2/';

var ccex_access_key = 'EEF0E571C1782E5BDBCDB56B38578442',
    ccex_secret_key = '9CC053F6BD0CF5DD25CDC44552A33A3E';//,
//    ccex_base_pub_url = 'https://c-cex.com/t/api_pub.html?a=',
//    ccex_base_priv_url = 'https://c-cex.com/t/api.html?a=';

var gap = 0.0000000011,	// 0.1 sat + epsilon
//	min_btc = 0.001,
	max_btc = 0.005,
	volume_prec = 0.0001,
	max_price=0.000001, // 100 sats (todo)
	dist_from_bottom_ask = 0.0000001, // 10 sats (todo)
    symbol = 'MIX/BTC';

const ccxt = require('ccxt'),
      ccex = new ccxt.ccex({
            apiKey: ccex_access_key,
            secret: ccex_secret_key
      });

(async function () {

    var ticker =  await (ccex.fetchTicker (symbol)),
        orderbook = await ccex.fetchOrderBook (symbol);
//        if (exchange.has['fetchOpenOrders'])
//        openorders = await ccex.fetchOpenOrders (symbol = symbol);
//        balance = await ccex.fetchBalance

//    console.log (ccex.id, new ccxt.ccex ()); <-- full ref
    console.log (ccex.id, ccex.private_get_getopenorders());
}) ();

function ccex_fetch_open_orders () {
}

return;
var crypto = require('crypto'),
    request = require('request'),
	https = require('https');

//send_authed_cmd('markets');
//send_authed_cmd('order_book.json', '&market=mixbtc&asks_limit=1&bids_limit=10'); // additional params break sig :/ Maybe because params must be alphabetically ordered. >:|
//send_authed_cmd('order_book.json', '&market=mixbtc'); //works
//send_authed_cmd('orders.json', '&market=mixbtc'); //works

// algo --
// get order book
// get my orders
// substract to get others' orders
// calculate where my orders should be
// apply diff.

go();

function go() {
	var orderbook = null,
		myorders = null;

	send_authed_get_cmd('orders.json', '&market=mixbtc', function(parsed_body) {

			myorders = parsed_body; // mildly racy
			if (orderbook != null)
				comparebooks(orderbook, myorders);
		});

	send_authed_get_cmd('order_book.json', '&market=mixbtc', function(parsed_body) {

			orderbook = parsed_body;
			if (myorders != null)
				comparebooks(orderbook, myorders);
		});
}

function comparebooks(orderbook, myorders) {

	var my_ids = {},
		othersorders = [],
		myneworders = [],
//		trimmedneworders = [],
		orderstodelete = [],
		found,
		kept_btc = 0,
		released_btc = 0,
		new_btc = 0,
		used_btc = 0,
		btc_tospend = 0,
		last_new_order = 0,
		noof_to_delete = 0,
		max_price = get_max_price(orderbook);

	for (var order in myorders) {
//		console.log(myorders[order].id);
		my_ids[myorders[order].id]++;
	}

//	othersorders = JSON.parse(JSON.stringify(orderbook)); // deep clone

	for (var order in orderbook.bids) {

		if (my_ids[orderbook.bids[order].id] != null) {
//			console.log("mine");
		} else {
//			console.log("not mine");
			othersorders.push(orderbook.bids[order]); // needed?
			found = 0;
			for (var oldorder in myorders) {

//				console.log('price=' + orderbook.bids[order].price + ' gap=' + gap + ' sum=' + (parseFloat(orderbook.bids[order].price) + gap));
				if (Math.abs(parseFloat(orderbook.bids[order].price) + gap - parseFloat(myorders[oldorder].price)) < gap / 2 &&
					Math.abs(parseFloat(orderbook.bids[order].volume) - parseFloat(myorders[oldorder].remaining_volume)) < volume_prec) {

					if (myorders[oldorder].price > max_price) {

						console.log("Cancelling existing order (" + (parseFloat(orderbook.bids[order].price) + gap) + ", " + orderbook.bids[order].volume +
									"because it's higher than updated maximum price.");
					} else {
						myorders[oldorder].keep++;
						console.log("Keeping: " + JSON.stringify(myorders[oldorder], null, 2));
						kept_btc += parseFloat(myorders[oldorder].price) * parseFloat(myorders[oldorder].volume);
					}
					found++;
					break;
				}
			}
			if (found == 0) {

				if (parseFloat(orderbook.bids[order].price) + gap > max_price) {

					console.log("Won't add new order at (" + (parseFloat(orderbook.bids[order].price) + gap) + ", " + orderbook.bids[order].volume + ") because max_price=" +
								max_price);
				} else {
					console.log("Adding new order " + order + " at " + orderbook.bids[order].price);
					myneworders.push({
						price: parseFloat(orderbook.bids[order].price) + gap,
						volume: orderbook.bids[order].volume,
						tot_btc: (parseFloat(orderbook.bids[order].price) + gap) * parseFloat(orderbook.bids[order].volume)
					});
					new_btc += (parseFloat(orderbook.bids[order].price) + gap) * parseFloat(orderbook.bids[order].volume);
				}
			}
		}
	}

	for (var order in myorders) {

		if (myorders[order].keep == null) {
			orderstodelete.push(myorders[order]);
			released_btc += parseFloat(myorders[order].price) * parseFloat(myorders[order].volume);
			noof_to_delete++;
		}
	}
	
	// max_btc should be limited available funds + released_btc, but I don't know how to get the former.
	btc_tospend = max_btc - kept_btc;

	for (var order in myneworders) {

		if (myneworders[order].tot_btc < btc_tospend) {
			btc_tospend -= myneworders[order].tot_btc;
//			console.log(order + " Left to spend: " + btc_tospend);
		} else if (btc_tospend < gap) {
			myneworders[order].volume = 0; // get here only if we kept more than max
			myneworders[order].tot_btc = 0;
		} else { // last order a partial
			myneworders[order].volume = btc_tospend / myneworders[order].price;
			myneworders[order].tot_btc = btc_tospend;
			btc_tospend = 0;
			myneworders = myneworders.slice(0, parseInt(order) + 1);
			last_new_order = parseInt(order) + 1;
//			console.log(order + " All the rest at " + myneworders[order].price);
			break;
		}
	}

//	trimmedneworders = myneworders.slice(0, last_new_order);

//	console.log("\nMy orders:\n" + JSON.stringify(myorders, null, 2));
//	console.log("\nOrderbook:\n" + JSON.stringify(orderbook, null, 2));
//	console.log("\nOthers' orders:\n" + JSON.stringify(othersorders, null, 2));
	console.log("\n" + last_new_order + " orders in myneworders:\n" + JSON.stringify(myneworders, null, 2));
	console.log("\n" + noof_to_delete + " orders to delete:\n" + JSON.stringify(orderstodelete, null, 2));
	console.log("kept_btc=" + kept_btc + " released_btc=" + released_btc + " new_btc=" + new_btc);
//	console.log("\nHi there!\n");

	replace_orders(orderstodelete, myneworders);
}

function get_max_price(orderbook) {

	console.log("hard max_price: " + max_price);

	for (var order in orderbook.asks) {

//		if (orderbook.asks[order].side == 'sell') {

//			console.log("Sell order at " + orderbook.asks[order].price + ". -=dist -> " + (orderbook.asks[order].price - dist_from_bottom_ask) + ". max_price = " + max_price);

			if (orderbook.asks[order].price - dist_from_bottom_ask < max_price)
				max_price = orderbook.asks[order].price - dist_from_bottom_ask;
		}
//	}

	console.log("new max_price: " + max_price);

	return max_price;
}

function replace_orders(orderstodelete, myneworders) {

	var orders = 0;

	if (orderstodelete.length == 0)
		return set_new_orders(myneworders);

	for (var order in orderstodelete) {
		
		send_authed_post_cmd('order/delete.json', orderstodelete[order].id, parseInt(new Date().getTime()) + parseInt(order), function () {
		
			if (++orders == orderstodelete.length)
				set_new_orders(myneworders);
		});
	}

//	for (var order in orderstodelete) {

//		send_
//	}
}

function set_new_orders(neworders) {
	
	for (var order in neworders) {

		send_authed_buy_cmd('orders.json', neworders[order].price, neworders[order].volume, parseInt(new Date().getTime()) + parseInt(order), function () {

			console.log("Set a buy for " + neworders[order].volume + " coins at " + neworders[order].price);
		});
	}
}

function send_authed_buy_cmd(cmd, price, volume, tonce, func) {

	var /*tonce = new Date().getTime(),*/
//		payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + graviex_access_key + '&market=mixbtc&side=buy&volume=' + volume + '&price=' + price + '&tonce=' + tonce,
		payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + graviex_access_key + '&market=mixbtc&price=' + price + '&side=buy&tonce=' + tonce + '&volume=' + volume,
		hash = crypto.createHmac('sha256', graviex_secret_key).update(payload).digest('hex'),
		req = graviex_base_url + graviex_api_path + cmd,
//		data = 'access_key=' + graviex_access_key + '&id=' + id + '&tonce=' + tonce + '&signature=' + hash,
		agentOptions = {
			host: 'graviex.net',
			port: '443',
			path: '/',
			rejectUnauthorized: false
		},
		agent = new https.Agent(agentOptions);

console.log('payload=' + payload);
console.log('hash=' + hash);

	request ({
			url: req,
			method: 'POST',
			agent: agent,
			form: {
				access_key: graviex_access_key,
				market: 'mixbtc',
				side: 'buy',
				volume: volume,
				price: price,
				tonce: tonce,
				signature: hash
			}
		}, function (err, resp, body) {
			console.log('request: ' + req);
			if (err) console.log('Error: ' + err);
//			console.log('Response: ' + JSON.stringify(resp, null, 2));
			try {
				console.log('Body: ' + JSON.stringify(JSON.parse(body), null, 2));
			}
			catch(e) {
				console.log('Invalid JSON is Body: ' + body);
			}
//			console.log('Body: ' + body);
	
			if (func!=null) func(JSON.parse(body));
		});
}

function send_authed_post_cmd(cmd, id, tonce, func) {

	var /*tonce = new Date().getTime(),*/
		payload = 'POST|' + graviex_api_path + cmd + '|access_key=' + graviex_access_key + '&id=' + id + '&tonce=' + tonce,
		hash = crypto.createHmac('sha256', graviex_secret_key).update(payload).digest('hex'),
		req = graviex_base_url + graviex_api_path + cmd,
//		data = 'access_key=' + graviex_access_key + '&id=' + id + '&tonce=' + tonce + '&signature=' + hash,
		agentOptions = {
			host: 'graviex.net',
			port: '443',
			path: '/',
			rejectUnauthorized: false
		},
		agent = new https.Agent(agentOptions);

	request ({
			url: req,
			method: 'POST',
			agent: agent,
			form: {
				access_key: graviex_access_key,
				id: id,
				tonce: tonce,
				signature: hash
			}
		}, function (err, resp, body) {
			console.log('request: ' + req);
			if (err) console.log('Error: ' + err);
//			console.log('Response: ' + JSON.stringify(resp, null, 2));
			try {
				console.log('Body: ' + JSON.stringify(JSON.parse(body), null, 2));
			}
			catch(e) {
				console.log('Invalid JSON is Body: ' + body);
			}
//			console.log('Body: ' + body);
	
			if (func!=null) func(JSON.parse(body));
		});
}

function send_authed_get_cmd(cmd, params, func) {

	var tonce = new Date().getTime(),
		payload = 'GET|' + graviex_api_path + cmd + '|access_key=' + graviex_access_key + params + '&tonce=' + tonce,
		hash = crypto.createHmac('sha256', graviex_secret_key).update(payload).digest('hex'),
		req = graviex_base_url + graviex_api_path + cmd + '?access_key=' + graviex_access_key + params + '&tonce=' + tonce + '&signature=' + hash,
		agentOptions = {
			host: 'graviex.net',
			port: '443',
			path: '/',
			rejectUnauthorized: false
		},
		agent = new https.Agent(agentOptions);

//	request.get(req, function (error, response, body) {
	request({
			url: req,
			method: 'GET',
			agent: agent
		}, function (err, resp, body) {

		//console.log('request: ' + req);
		if (err) console.log('Error: ' + err);
		//console.log('Response: ' + resp);
		//console.log('Body: ' + JSON.stringify(JSON.parse(body), null, 2));

		if (func!=null) func(JSON.parse(body));
	});
}


return;

//hash = crypto.createHmac('sha1', key).update(text).digest('hex')
//console.log(hash);

//  , text = 'I love cupcakes'
//  , key = 'abcdeg'
//  , hash

/*
 * websocket endpoint times out :/
 *
//var WebSocket = require('websocket');
const WebSocket = require('ws');

var host = 'wss://graviex.net:8080';
var socket = new WebSocket(host);
socket.onopen = function() {
          console.log("opened");
}

socket.onmessage = function(msg) {
          console.log(msg);
}

socket.onclose = function() {
          console.log("closed");
}*/
