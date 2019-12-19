import config from './config';

interface ITestCase {
    name: string;
    endpoint: string;
    expect: {
        responseCode: number;
        validations: boolean | string[];
    };
}

const getSuccessEndpointForFileExt = (ext: string) => {
    const endpoint = Object.keys(config.pathFileMapping)
        .find((key) => config.pathFileMapping[key].endsWith(`.${ext}`));

    if (!endpoint) {
        throw new TypeError(`config.pathFileMapping must contain an endpoint for ${ext} filetype`);
    }

    return endpoint;
};

const get404Endpoint = () => {
    return '%F0%9F%A6%84';
};

const guidedTestPlan: ITestCase[] /* TODO */ = [
    {
        name: 'PDF retrieval',
        endpoint: getSuccessEndpointForFileExt('pdf'),
        expect: {
            responseCode: 200,
            validations: true, // all
        },
    },
    {
        name: 'Not found',
        endpoint: get404Endpoint(),
        expect: {
            responseCode: 404,
            validations: [], // none
        },
    },
    // {
    //     name: 'JSON retrieval',
    //     endpoint: '',
    //     expect: {
    //         responseCode: 200,
    //         validations: true,
    //     },
    // },
    // {
    //     name: 'XML retrieval',
    //     endpoint: '',
    //     expect: {
    //         responseCode: 200,
    //         validations: true,
    //     },
    // },
    // {
    //     name: 'HTML retrieval',
    //     endpoint: '',
    //     expect: {
    //         responseCode: 200,
    //         validations: true,
    //     },
    // },
];

export default guidedTestPlan;