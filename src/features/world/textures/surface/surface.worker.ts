import { bakeRecipe } from "./recipes";

interface BakeRequest {
	id: number;
	key: string;
	detail: number;
}

self.onmessage = (event: MessageEvent<BakeRequest>) => {
	const { id, key, detail } = event.data;
	try {
		const baked = bakeRecipe(key, detail);
		self.postMessage(
			{ id, baked },
			{
				transfer: [baked.albedo.buffer, baked.normal.buffer, baked.orm.buffer],
			},
		);
	} catch (error) {
		self.postMessage({ id, error: String(error) });
	}
};
