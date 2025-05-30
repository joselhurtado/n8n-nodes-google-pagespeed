import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GooglePageSpeedApi implements ICredentialType {
	name = 'googlePageSpeedApi';
	displayName = 'Google PageSpeed Insights API';
	documentationUrl = 'https://developers.google.com/speed/docs/insights/v5/get-started';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Google API Key with PageSpeed Insights API enabled',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://www.googleapis.com/pagespeedonline/v5',
			url: '/runPagespeed',
			method: 'GET',
			qs: {
				url: 'https://example.com',
				strategy: 'mobile',
				category: 'performance',
			},
		},
	};

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				key: '={{$credentials.apiKey}}',
			},
		},
	};
}
