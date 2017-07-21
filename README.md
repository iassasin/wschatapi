# wschatapi
API для написания своих клиентов к чату https://sinair.ru/chat/
## Установка
```
npm install https://github.com/iassasin/wschatapi.git
```
## Использование
После установки модуля, его использование в проекте аналогично другим:
```javascript
const WsChat = require('wschatapi');
```
Первым делом нужно создать подключение, затем назначить коллбеки и установить соединение.  
Ниже приведен пример простого подключения и отправки сообщения:
```javascript
let chat = new WsChat('wss://sinair.ru/ws/chat');
chat.onOpen = function(){
	chat.joinRoom('#test', (success, room) => {
		room.sendMessage('/nick testbot');
		room.sendMessage('Привет, я бот!');
		chat.close();
	});
};
chat.open();
```
## Методы API
В API используются два класса, доступные пользователю:
* `WsChat` - основной класс подключения и обработки событий;
* `Room` - класс подключения к конкретной комнате, его нельзя инстанцировать вручную, но к нему появляется доступ после подключения к комнате.

### WsChat
Представляет собой набор управляющих методов и событий.

Каждый коллбек первым аргументом получает `success` - булевое значение, означающее, успешно ли завершилась операция. В случае, если `success` принимает значение `false`, вторым аргументом всегда будет объект, описывающий ошибку.

Часть методов могут иметь коллбэки, которые (если заданы) перекрывают аналогичные глобальные обработчики событий. Чтобы глобальный обработчик вызывался в любом случае, необходимо из коллбэка вернуть значение `true`. Например:
```javascript
chat.onJoinedRoom = function(room){ /* ... */ };
chat.joinRoom('#chat', function(success, room){
	// ...
	return true;
});
```

Методы.  
Ниже будет встречаться параметр `room` - объект класса `Room`.
* `WsChat(address)` - конструктор класса, `address` - адрес websocket-сервера чата, например `wss://sinair.ru/ws/chat`;
* `open()` - установить соединение с сервером;
* `close()` - закрыть соединение с сервером;
* `authByKey(key, callback(success, userinfo))` - выполнить авторизацию на сервере с помощью временного ключа (получается только через сайт авторизованными пользователями);
* `authByApiKey(key, callback(success, userinfo))` - выполнить авторизацию на сервере с помощью постоянного API-ключа (получается только посредством связи с администратором чата);
* `changeStatus(status)` - изменить свой статус. Допустимы только значения `UserStatus.away` и `UserStatus.back`;
* `joinRoom(target, callback(success, room))` или `joinRoom(options)` - присоединиться к комнате `target`. Также можно передать вместо аргументов объект опций. Опции по-умолчанию следующие:
```
{
	target: '',
	callback: null,
	autoLogin: false, //автоматически войти в комнату с ником, который использовался в ней ранее (для авторизованных пользователей)
	loadHistory: false, //загрузить последние 50 сообщений в комнате
}
```
* `leaveRoom(target, callback(success, room))` - покинуть комнату `target`;
* `createRoom(target, callback(success))` - создать комнату с именем `target`;
* `removeRoom(target, callback(success))` - удалить свою комнату с именем `target`;
* `getConnectedRooms()` - получить список комнат, к которым были осуществлены подключения;
* `getRoomByTarget(target)` - найти комнату с именем `target` в списке подключенных.

События:
* `onOpen()` - вызывается после подключения к серверу;
* `onClose()` - вызывается после отключения от сервера;
* `onConnectionError(error)` - вызывается при возникновении ошибки подключения;
* `onError(error)` - вызывается для необработанных ошибок при работе с API чата;
* `onJoinedRoom(room)` - вызывается после подключения к комнате;
* `onLeaveRoom(room)` - вызывается после отключения от комнаты;
* `onRoomCreated(target)` - вызывается после успешного создания комнаты `target`;
* `onRoomRemoved(target)` - вызывается после успешного удаления комнаты `target`;
* `onMessage(room, msgobj)` - вызывается, когда кто-то написал сообщение в комнату. `msgobj` - объект сообщения (будет описан ниже);
* `onSysMessage(room, text)` - вызывается при получении системного сообщения. Когда сообщение не относится ни к одной комнате, `room` принимает значение `null`;
* `onUserStatusChanged(room, userobj)` - вызывается при изменении статуса подключенного к комнате пользователя; `userobj` - объект информации о пользователе (будет описан ниже);
* `onUserConnected(room, userobj)` - вызывается при подключении к комнате нового пользователя;
* `onUserDisconnected(room, userobj)` - вызывается при отключении пользователя от комнаты.

### Room
Класс, предоставляющий набор методов и событий для конкретной комнаты. События по описанию аналогичны глобальным, поэтому могут не описываются повторно.

Методы:
* `sendMessage(text)` - отправить сообщение в комнату;
* `changeStatus(status)` - изменить свой статус. Допустимы только следующие значения `UserStatus`: `away`, `back`, `typing`, `stop_typing`;
* `getTarget()` - получить имя текущей комнаты;
* `getMembers()` - получить список онлайна текущей комнаты;
* `getMemberById(id)` - получить инфо пользователя по его id;
* `getMyMemberId()` - получить свой id в комнате;
* `getMyMemberNick()` - получить свой текущий ник в комнате.

События:
* `onError(err)`;
* `onSysMessage(message)`;
* `onMessage(msgobj)`;
* `onUserStatusChanged(user)`;
* `onUserConnected(user)`;
* `onUserDisconnected(user)`;
* `onJoined()`;
* `onLeave()`;

### UserStatus
Перечисление всех возможных статусов пользователей:
* `bad` - если вы получили такой статус, что-то точно пошло не так;
* `offline` - пользователь отключился;
* `online` - пользователь онлайн;
* `away` - пользователь отошел;
* `nick_change` - пользователь изменил ник;
* `gender_change` - пользователь сменил пол;
* `color_change` - пользователь перекрасил ник;
* `back` - пользователь вернулся (после статуса `away`);
* `typing` - пользователь начал набирать сообщение;
* `stop_typing` - пользователь перестал набирать сообщение.

### MessageStyle
Перечисления для определения типа присланного сообщения:
* `message` - обычное сообщение;
* `me` - сообщение о себе в третьем лице;
* `event` - сообщение от третьего лица;
* `offtop` - оффтоп (в чате выделяются серым).

### ErrorCode
Перечисление типа возникшей ошибки.
* `unknown` - незивестная ошибка;
* `database_error` - ошибка соединения с базой данных;
* `already_connected` - вы уже подключены (например, к комнате);
* `not_found` - при запросе что-то было не найдено (например, комната с таким именем);
* `access_denied` - доступ запрещен;
* `invalid_target` - неверно задано имя комнаты;
* `already_exists` - что-то уже существует (например, комната с таким именем).

### PackType
Перечисления типа пакета. Может использоваться при обработке ошибок.
* `error` - сообщение об ошибке;
* `system` - системное сообщение;
* `message` - сообщение;
* `online_list` - запрос список онлайна;
* `auth` - запрос авторизации;
* `status` - информация о пользователе;
* `join` - запрос на подключение к комнате;
* `leave` - запрос на отключение от комнаты;
* `create_room` - запрос на создание комнаты;
* `remove_room` - запрос на удаление комнаты;
* `ping` - служебный пакет для проверки связи.
