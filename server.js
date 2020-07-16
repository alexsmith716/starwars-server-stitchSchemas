import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import cors from 'cors';

import { print } from 'graphql';
import fetch from 'node-fetch';

import {
	stitchSchemas,
} from '@graphql-tools/stitch';

import {
	delegateToSchema,
	FilterToSchema,
} from '@graphql-tools/delegate';

import {
	wrapSchema,
	FilterRootFields,
	RenameTypes,
	RenameRootFields,
	TransformQuery,
	introspectSchema,
} from '@graphql-tools/wrap';

import {
	mapSchema,
	MapperKind,
	getDirectives,
} from '@graphql-tools/utils';

import swapiSchema from './data/schema';

const PORT = 4000;
const app = express();
app.use('*', cors());

const executor = async ({ document, variables }) => {
	const query = print(document);
	const fetchResult = await fetch('https://rickandmortyapi.com/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables })
	});
	return fetchResult.json();
};

(async () => {

	const wrappedSchema = wrapSchema({
		schema: await introspectSchema(executor),
		executor,
	});

	const chirpSchemaTransforms = [
		new RenameTypes((name) => `Chirp_${name}`),
		new RenameRootFields((name) => `Chirp_${name}`),
	];

	const chirpSubschema = {
		schema: wrappedSchema,
		transforms: chirpSchemaTransforms,
	}

	const finalSchema = stitchSchemas({
		subschemas: [
			swapiSchema,
			chirpSubschema
		],
	});

	const server = new ApolloServer({
		schema: finalSchema,
		subscriptions: { path: "/websocket" }
	});

	server.applyMiddleware({ app });
	const httpServer = createServer(app);
	server.installSubscriptionHandlers(httpServer);
	
	httpServer.listen(PORT, () => {
		console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
		console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}${server.subscriptionsPath}`);
	});

})();
