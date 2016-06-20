
/**
 * interface comment { so; what?; }
 */
interface Iface1 extends Iface2 {
    myFunc(param1: string, param2?: () => { [id:string] : number } ) : (x,y) => (z:number) => MyClass;
    aProperty;
    aProperty2?:string;
    aProperty3:number;    
    noParamNoReturnType();
    regular(some:string):Iface2
}

interface Iface2 {
    // line comment here    
    prop1: string;
    
    /**
     * This is my optional property
     * @property prop2 - a description here
     */
    prop2?: () => any;
    
    /**
     * @property {NuMbEr} prop3
     */
    prop3:number;
}


/**
 * class CommentClass implements comment { public haha() {} }
 */
abstract class MyClass extends Base implements Iface1, ng.Iface2 {
    // What's up? this is a line comment with a single quote character

    /**
     * @param other
     */
    constructor(protected other: OtherClass = null) {
        super();
        var x = call_stuff(42, () => 5 );
        var x = call_stuff2(x => {
            if (then) rather();
        });
        thisIsAmethodCall(some, stuff);
    }

    /**
     * @param param2 - da!
     */
    protected myFunc (param1 : string, param2?: () => { [id:string] : number } ) : (x,y) => (z:number) => { [x:string]:{ "}":number } }
    {
        throw 'x';
    }

    /**
     * @returns {string} - somestring 
     */
    private returner():string {
        return '';
    }

    private thingy = {
        blah: 5
    };

    private thingyBuilderMap: { [id:string] : () => Thingy } = {};

    /** what now? */
    noParamNoReturnType() {
        return 0;
    }

    public promiseMeSomething(x:number = 42 , y): Promise<Something> {
        return Promise.resolve(new Something());
    }

    /**
     * Example: 
     * public thisIsCommented(param) { }
     */
    abstract public absPub(): { didItWork?:boolean } {}
    public abstract pubAbs() {}

    /**
     * @inheritDoc
     */
    inherited(param1:number) {

    }
}

