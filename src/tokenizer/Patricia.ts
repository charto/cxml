import { ArrayType, concatArray } from '../Buffer';
import { InternalToken } from '../parser/InternalToken';

class Node {
	constructor(
		public token: InternalToken | null,
		public buf: ArrayType,
		public len: number,
		public first?: Node,
		public second?: Node
	) {}

	clone(): Node {
		const other = new Node(
			this.token,
			this.buf,
			this.len,
			this.first && this.first.clone(),
			this.second && this.second.clone()
		);

		return(other);
	}
}

/** Maximum number of bits per node (number must fit in 1 byte). */
const MAX_LEN = 255; // Test edge cases by using smaller numbers (>= 8) here!

/** Must equal Patricia :: notFound on C++ side. */
export const NOT_FOUND = 0x7fffff;

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
	clone() {
		const other = new Patricia();

		other.root = this.root.clone();

		return(other);
	}

	insertNode(token: InternalToken) {
		let pos = 0;
		let root = this.root;

		if(!token.name) {
			throw(new Error('Empty strings not supported'));
		}

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
			let bit = 0;

			if(rest) {
				let c = token.buf[pos] ^ node.buf[cursor.pos];

				while(!(c & 0x80)) {
					c <<= 1;
					++bit;
				}
			} else {
				// The new node is a prefix of this node.
				// Cut this node at a byte boundary.
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
			node.buf = node.buf.slice(0, cursor.pos + ((bit + 7) >> 3));
			node.len = cursor.pos * 8 + bit;
		} else if(!rest) {
			throw(new Error('Duplicates not supported: ' + token.name));
		} else {
			// The new node only extends an existing node.
			node.first = rest;
		}
	}

	insertList(tokenList: InternalToken[]) {
		for(let token of tokenList) {
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

	private static encodeNode(
		node: Node,
		dataList: ArrayType[]
	) {
		let len = node.len;
		let partLen: number;
		let byteLen: number;
		let totalByteLen = 0;
		let posIn = -1;
		let posOut: number;

		while(len) {
			partLen = len;
			if(partLen > MAX_LEN) partLen = MAX_LEN & ~7;

			// Convert bit to byte length rounding up, add 1 byte for length
			// header and 3 bytes for reference
			// (token ID or offset to second child).
			byteLen = (partLen + 7) >> 3;
			const data = new ArrayType(byteLen + 4);

			dataList.push(data);
			totalByteLen += byteLen + 4;

			posOut = 0;

			data[posOut] = partLen;
			while(posOut < byteLen) data[++posOut] = node.buf[++posIn];

			let ref: number;

			if(len > MAX_LEN) {
				ref = NOT_FOUND;
			} else {
				let nextTotalLen = 0;
				if(node.first) nextTotalLen += Patricia.encodeNode(node.first, dataList);

				if(node.second) {
					ref = nextTotalLen + 3;
					nextTotalLen += Patricia.encodeNode(node.second, dataList);
				} else {
					// ref = tokenSet.encode(node.token!) || 0;
					ref = node.token!.id;
					if(!node.first) ref |= 0x800000; // See 0x80 in PatriciaCursor.cc
				}

				totalByteLen += nextTotalLen;
			}

			data[++posOut] = ref >> 16;
			data[++posOut] = ref >> 8;
			data[++posOut] = ref;

			len -= partLen;
		}

		return(totalByteLen);
	}

	encode() {
		const dataList: ArrayType[] = [];

		// Encode trie contents into a buffer.
		const dataLen = Patricia.encodeNode(
			this.root || Patricia.sentinel,
			dataList
		);

		return(concatArray(dataList, dataLen));
	}

	/** Represents the root of an empty tree. */
	private static sentinel = new Node(
		InternalToken.empty,
		InternalToken.empty.buf,
		InternalToken.empty.buf.length * 8
	);

	private root: Node;
}
