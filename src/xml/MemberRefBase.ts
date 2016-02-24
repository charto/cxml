// This file is part of cxml, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

export class MemberRefBase<Member> {
	constructor(member: Member, min: number, max: number) {
		this.member = member;
		this.min = min;
		this.max = max;
	}

	member: Member;
	min: number;
	max: number;

	safeName: string;

	static optionalFlag = 1;
	static arrayFlag = 2;
}
