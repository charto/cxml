import { ArrayType, concatArray } from './Buffer';
import { Token } from './Token';

class Node {
	constructor(
		public token: Token | null,
		public buf: ArrayType,
		public len: number,
		public first?: Node,
		public second?: Node
	) {}
}

class PatriciaCursor {
	constructor(public node: Node) {
		this.pos = 0;
		this.len = node.len;
	}

	advance(c: number) {
		let node = this.node;
		let b = node.buf;
		let p = this.pos;
		let len = this.len;
		let delta = 0;

		while(len < 8) {
			if(len) {
				delta = (c ^ b[p++]) >> (7 - len);
			} else {
				if(!node.first) return(false);
				delta = 0;
			}

			if(delta) {
				if(delta > 1) {
					this.node = node;
					this.pos = p - 1;
					this.len = len;

					return(false);
				}

				node = node.second!;
			} else {
				node = node.first!;
			}

			b = node.buf;
			p = 0;
			len = node.len;
		}

		if(c != b[p++]) {
			this.node = node;
			this.pos = p - 1;
			this.len = len;

			return(false);
		}

		len -= 8;

		this.node = node;
		this.pos = p;
		this.len = len;

		return(true);
	}

	pos: number;
	len: number;
}

export class Patricia {
	insertNode(token: Token) {
		// TODO: Split all nodes longer than 32 bytes.

		let pos = 0;
		let root = this.root;

		if(!root) {
			root = new Node(token, token.buf, token.buf.length * 8);
			this.root = root;
			return;
		}

		let cursor = new PatriciaCursor(root);

		while(pos < token.buf.length && cursor.advance(token.buf[pos])) ++pos;

		const node = cursor.node;
		let rest: Node | undefined;

		if(pos < token.buf.length) {
			rest = new Node(
				token,
				token.buf.slice(pos),
				(token.buf.length - pos) * 8
			);
		}

		if(cursor.len) {
			let bit: number;

			if(rest) {
				const c = token.buf[pos] ^ node.buf[cursor.pos];
				bit = 0;

				while(bit++ < 8) {
					if((c >> (8 - bit)) & 1) break;
				}
			} else {
				// The new node is a prefix of this node.
				// Cut this node at a byte boundary.
				bit = 1;
			}

			// Split the node.

			node.first = new Node(
				node.token!,
				node.buf.slice(cursor.pos),
				node.len - cursor.pos * 8,
				node.first,
				node.second
			);

			node.second = rest;

			node.token = rest ? null : token;
			node.buf = node.buf.slice(0, cursor.pos + (+(bit > 1)));
			node.len = cursor.pos * 8 + bit - 1;
		} else if(!rest) {
			throw(new Error('Duplicates not supported: ' + token.name));
		} else {
			// The new node only extends an existing node.
			node.first = rest;
		}
	}

	insertList(tokenList: Token[]) {
		for(let token of tokenList) {
			if(!token.name) {
				throw(new Error('Empty strings not supported'));
			}

			this.insertNode(token);
		}

		// Verify that the tokens were correctly inserted!

		for(let token of tokenList) {
			let pos = 0;
			let root = this.root;

			let cursor = new PatriciaCursor(root);

			while(pos < token.buf.length) {
				if(!cursor.advance(token.buf[pos++])) {
					throw(new Error('Inserted token missing: ' + token.name));
				}
			}

			if(cursor.node.token != token) {
				throw(new Error('Wrong token inserted for: ' + token.name));
			}
		}
	}

	encode() {
		let dataLen = 0;
		const dataList: ArrayType[] = [];

		function encodeNode(node: Node) {
			const len = node.buf.length + 4;
			const data = new ArrayType(len);

			dataList.push(data);
			dataLen += len;
			let prevDataLen = dataLen;

			let pos = 0;

			data[pos++] = node.len;
			for(let c of node.buf as any) data[pos++] = c;

			if(node.first) encodeNode(node.first);

			let ref: number;

			if(node.second) {
				ref = dataLen - prevDataLen + 3;
				encodeNode(node.second);
			} else {
				ref = node.token!.id || 0;
				if(!node.first) ref |= 0x800000; // See 0x80 in PatriciaCursor.cc
			}

			data[pos++] = ref >> 16;
			data[pos++] = ref >> 8;
			data[pos++] = ref;
		}

		const sentinel = Patricia.sentinel;

		// Encode trie contents into a buffer.
		encodeNode(this.root || new Node(sentinel, sentinel.buf, sentinel.buf.length * 8));

		return(concatArray(dataList, dataLen));
	}

	/** Represents the root of an empty tree. */
	private static sentinel = new Token('\0', 0x7fffff); // Patricia :: notFound

	private root: Node;
}
