
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
    prop1: string;
    prop2?: () => any;
    prop3;
}


/**
 * class CommentClass implements comment { public haha() {} }
 */
abstract class MyClass extends Base implements Iface1, Iface2 {

    constructor(other) {
        super();
        var x = call_stuff(42, () => 5 );
        var x = call_stuff2(x => {
            if (then) rather();
        });
        thisIsAmethodCall(some, stuff);
    }

    protected myFunc (param1 : string, param2?: () => { [id:string] : number } ) : (x,y) => (z:number) => { [x:string]:{ "}":number } }
    {
        throw 'x';
    }

    private thingyBuilderMap: { [id:string] : () => Thingy } = {};

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
}

