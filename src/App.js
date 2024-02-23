import { useState, useEffect, useCallback } from 'react';
import useWebSocket from 'react-use-websocket';

function ChatComponent() {
	const authToken = process.env.REACT_APP_AUTH_TOKEN;
	const WS_URL = process.env.REACT_APP_WS_URL;

	const [rooms, setRooms] = useState([]);
	const [messages, setMessages] = useState({}); // Messages stored by roomId

	const { sendMessage } = useWebSocket(WS_URL, {
		onOpen: () => {
			console.log('WebSocket Connected');

			// 1- do connect
			sendMessage(
				JSON.stringify({
					msg: 'connect',
					version: '1',
					support: ['1', 'pre2', 'pre1'],
				})
			);

			// 2- do login
			sendMessage(
				JSON.stringify({
					msg: 'method',
					method: 'login',
					id: '42',
					params: [{ resume: authToken }],
				})
			);

			// 3- get rooms
			sendMessage(
				JSON.stringify({
					msg: 'method',
					method: 'rooms/get',
					id: '43',
					params: [{ $date: 0 }],
				})
			);
		},
		onMessage: (event) => {
			const data = JSON.parse(event.data);
			if (data.msg === 'ping') {
				sendMessage(JSON.stringify({ msg: 'pong' }));
			}

			if (data.msg === 'result' && data.id === '43') {
				// Handle rooms/get result=
				setRooms(data.result.update);
				localStorage.setItem('rooms', JSON.stringify(data.result.update));
			}

			if (data.msg === 'updated' && data.methods[0].startsWith('room_')) {
				const roomId = data.methods[0].substring(5);
				/*ask load history*/
				const historyRequest = {
					msg: 'method',
					method: 'loadHistory',
					id: 'messages_' + roomId,
					params: [roomId, null, 10, { $date: 0 }],
				};

				sendMessage(JSON.stringify(historyRequest));
			}

			if (data.msg === 'result' && data.id.startsWith('messages_')) {
				const roomId = data.id.substring(9);
				const messages = data.result.messages;
				setMessages(() => ({
					[roomId]: messages,
				}));

				const subscribeRequest = {
					msg: 'sub',
					id: roomId,
					name: 'stream-room-messages',
					params: [roomId, { useCollection: false, args: [] }],
				};

				sendMessage(JSON.stringify(subscribeRequest));
			}

			if (
				data.msg === 'changed' &&
				data.collection === 'stream-room-messages'
			) {
				const roomId = data.fields.eventName;
				const message = data.fields.args[0];
				setMessages((prev) => ({
					...prev,
					[roomId]: [message, ...prev[roomId]],
				}));
			}
			return false;
		},
	});

	useEffect(() => {
		localStorage.clear();
		const localRooms = localStorage.getItem('rooms');
		if (localRooms) {
			setRooms(JSON.parse(localRooms));
		}
	}, []);

	const handleChannelClick = useCallback(
		(roomId) => {
			// Open room
			sendMessage(
				JSON.stringify({
					msg: 'method',
					method: 'openRoom',
					id: `room_${roomId}`,
					params: [roomId],
				})
			);

			// Load history for the room
			sendMessage(
				JSON.stringify({
					msg: 'method',
					method: 'loadHistory',
					id: `messages_${roomId}`,
					params: [roomId, null, 10, { $date: 0 }],
				})
			);
		},
		[sendMessage]
	);

	const formatIsoDate = (isoDate) => {
		const date = new Date(isoDate);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	};

	return (
		<div>
			<h2>Rooms</h2>
			<div>
				{rooms.map((room) => (
					<button key={room._id} onClick={() => handleChannelClick(room._id)}>
						{room.name}
					</button>
				))}
			</div>
			<div>
				{Object.entries(messages).map(([roomId, roomMessages]) => (
					<div key={roomId}>
						<h3>Messages in {roomId}</h3>
						{roomMessages.map((msg, index) => (
							<div key={index} className="box">
								<p>
									{msg.u.name} || {formatIsoDate(msg.ts.$date)}
								</p>
								<p>{msg.msg}</p>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

export default ChatComponent;
