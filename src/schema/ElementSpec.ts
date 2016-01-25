import { Namespace as NamespaceBase } from '../Namespace';
import { MemberSpec } from './MemberSpec';
import { TypeSpec as TypeSpecBase } from './TypeSpec';

/** Element specification from schema. */

export class ElementSpec<
	Namespace extends NamespaceBase = NamespaceBase,
	TypeSpec extends TypeSpecBase = TypeSpecBase
> extends MemberSpec<Namespace> {

	getProxy(TypeSpec: TypeSpec) {
		let proxy = this.proxySpec;

		if(!proxy) {
			proxy = new this.TypeSpec();

			proxy.isProxy = true;
			// proxy.containingRef = this.getRef();

			this.proxySpec = proxy;
			// this.ns.addType(proxy);

			// if(!this.isAbstract) proxy.addChildSpec(this);
		}

		return(proxy);
	}

	TypeSpec: { new(): TypeSpec };

	/** Substitution group head. */
	substitutes: MemberSpec;

	/** Substitution group virtual type,
	  * containing all possible substitutes as children. */
	proxySpec: TypeSpec;

}

ElementSpec.prototype.TypeSpec = TypeSpecBase;
